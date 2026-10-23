'use client';
import type { DocType } from '@dpl/core';
import { useTranslations } from 'next-intl';
import { useRef, useState, type ChangeEvent, type CSSProperties, type ReactNode, type RefObject } from 'react';
import { api } from '@/lib/api';
import { Link, useRouter } from '@/i18n/navigation';
import { crawlDuration, slotVisual, splitSlots, type SlotVisual } from './model/documents';
import { CAMERA_ACCEPT, FILE_ACCEPT } from './model/file-types';
import { docsSubmitLine, KEY_RECORDS } from './model/progress';
import type { PortalDocument, PortalState } from './model/types';
import { IconAlert, IconArrow, IconBack, IconCamera, IconCheck, IconFile, IconFolder, IconHome, IconSend, IconShield, IconUpload } from '../ui/icons';
import { ProgressRing } from '../ui/ProgressRing';
import { PortalShell } from './PortalShell';
import { richTags } from './shared';
import { SubmittingScreen } from './SubmittingScreen';
import { useDocumentUploads, type SlotUpload } from './useDocumentUploads';

/** How long the "Sending your application" screen stays up at least (the prototype's 1.9 seconds). */
const SUBMITTING_MS = 1900;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface RowActions {
  onPick: (docType: DocType) => void;
  onCamera: (docType: DocType) => void;
  onCancel: (docType: DocType) => void;
  onRetry: (docType: DocType, file: File) => void;
}

function DocRow({ doc, upload, actions }: { doc: PortalDocument; upload: SlotUpload | undefined; actions: RowActions }) {
  const t = useTranslations('portal.documents');
  const visual: SlotVisual = slotVisual(doc.status, upload?.phase);
  const isKey = KEY_RECORDS.has(doc.docType);
  const done = visual === 'uploaded';
  const err = visual === 'error' || visual === 'failed';
  const up = visual === 'uploading';
  const req = visual === 'requested';

  const tag =
    visual === 'error'
      ? t('tags.unreadable')
      : visual === 'failed'
        ? t('tags.failed')
        : up
          ? t('tags.uploading')
          : done
            ? isKey
              ? t('tags.keyReceived')
              : t('tags.received')
            : req
              ? t('tags.requested')
              : isKey
                ? t('tags.key')
                : t('tags.helpful');
  const tagTone = done ? 'ui-badge-ok' : err ? 'ui-badge-bad' : up ? 'ui-badge-gold' : req ? 'ui-badge-warn' : isKey ? 'ui-badge-gold' : 'ui-badge-line';
  const Icon = done ? IconCheck : err ? IconAlert : up ? IconUpload : IconFile;

  let fileText: ReactNode = '';
  if (visual === 'uploaded') fileText = doc.fileName ? <bdi>{doc.fileName}</bdi> : '';
  else if (visual === 'error') fileText = doc.fileName ? t.rich('file.unreadable', { name: doc.fileName, ...richTags }) : t('file.unreadableNoName');
  else if (visual === 'uploading' && upload?.phase === 'uploading') fileText = t.rich('file.uploading', { name: upload.fileName, ...richTags });
  else if (visual === 'failed' && upload?.phase === 'failed') fileText = t.rich(`errors.${upload.reason}`, { name: upload.fileName, ...richTags });
  else if (req) fileText = doc.reviewNote ? <span dir="auto">{doc.reviewNote}</span> : t('file.requested');
  const note = visual === 'error' && doc.reviewNote ? doc.reviewNote : '';

  const actLabel = visual === 'uploaded' ? t('actions.replace') : err ? t('actions.retry') : up ? t('actions.cancel') : t('actions.upload');
  const onAct = () => {
    if (up) actions.onCancel(doc.docType);
    else if (upload?.phase === 'failed' && upload.file) actions.onRetry(doc.docType, upload.file);
    else actions.onPick(doc.docType);
  };

  const bar: CSSProperties & Record<'--pt-dur', string> = {
    '--pt-dur': `${crawlDuration(upload?.phase === 'uploading' ? upload.size : 0)}ms`,
  };
  const title = t(`slots.${doc.docType}.title`);

  return (
    <li data-doc-row className="ui-doc" data-visual={visual}>
      <span className="ui-doc-icon" aria-hidden="true">
        <Icon size={19} strokeWidth={done || err ? 2.1 : 1.7} />
      </span>
      <span className="ui-doc-body">
        <span className="ui-doc-title">
          {title}
          <span className={`ui-badge ${tagTone}`}>{tag}</span>
        </span>
        <span className="ui-doc-why">{t(`slots.${doc.docType}.why`)}</span>
        {fileText !== '' && <span className={err ? 'ui-doc-file ui-doc-file-bad' : 'ui-doc-file'}>{fileText}</span>}
        {note && (
          <span dir="auto" className="ui-doc-file ui-doc-file-bad">
            {note}
          </span>
        )}
        {up && (
          <span className="ui-doc-track">
            <span className="pt-bar" style={bar} />
          </span>
        )}
      </span>
      <span data-doc-act className="ui-doc-act">
        {!up && (
          <button
            type="button"
            className="ui-btn ui-btn-sm ui-btn-icon pt-camera"
            aria-label={`${t('actions.camera')}: ${title}`}
            onClick={() => actions.onCamera(doc.docType)}
          >
            <IconCamera size={18} />
          </button>
        )}
        <button
          type="button"
          className={`ui-btn ui-btn-sm ${up ? 'ui-btn-quiet' : err ? 'ui-btn-danger' : done ? '' : 'ui-btn-primary'}`}
          onClick={onAct}
          aria-label={`${actLabel}: ${title}`}
        >
          {!up && !done && !err && <IconUpload size={16} />}
          {actLabel}
        </button>
      </span>
    </li>
  );
}

/** The documents screen: the eight slots, uploads straight to storage, and the submit panel. */
export function DocumentsScreen({ initial }: { initial: PortalState }) {
  const t = useTranslations('portal');
  const router = useRouter();
  const { docs, uploads, start, cancel, announcement } = useDocumentUploads(initial.documents);
  const fileInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const slot = useRef<DocType | null>(null);
  const [phase, setPhase] = useState<'idle' | 'submitting'>('idle');
  const [submitFailed, setSubmitFailed] = useState(false);

  const submitted = !!initial.lead.submittedAt;
  const applicationComplete = initial.application?.complete ?? false;
  const total = docs.length;
  const received = docs.filter((d) => d.status === 'received').length;
  const percent = Math.round((received / total) * 100);
  const { todo, got } = splitSlots(docs);
  const submitLine = docsSubmitLine({ applicationComplete, hasReupload: docs.some((d) => d.status === 'reupload'), docsReceived: received, docsTotal: total });

  const pick = (input: RefObject<HTMLInputElement | null>) => (docType: DocType) => {
    slot.current = docType;
    input.current?.click();
  };
  const actions: RowActions = {
    onPick: pick(fileInput),
    onCamera: pick(cameraInput),
    onCancel: cancel,
    onRetry: (docType, file) => void start(docType, file),
  };
  const onFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const docType = slot.current;
    e.target.value = '';
    if (file && docType) void start(docType, file);
  };

  const submit = async () => {
    if (phase === 'submitting' || !applicationComplete) return;
    setSubmitFailed(false);
    setPhase('submitting');
    const [res] = await Promise.all([api('/api/portal/submit', { method: 'POST' }), sleep(SUBMITTING_MS)]);
    if (res.ok) {
      router.replace('/portal');
      return;
    }
    setPhase('idle');
    setSubmitFailed(true);
  };

  if (phase === 'submitting') return <SubmittingScreen />;

  const listCard = (id: string, title: string, count: string, items: PortalDocument[], tone: 'todo' | 'got') => (
    <section className="ui-card" aria-labelledby={id}>
      <div className="ui-card-head">
        <span className={`ui-icon-chip ${tone === 'got' ? 'ui-icon-chip-ok' : ''}`} aria-hidden="true">
          {tone === 'got' ? <IconCheck size={16} strokeWidth={2.2} /> : <IconFolder size={16} />}
        </span>
        <h2 id={id} className="ui-card-title">
          {title}
        </h2>
        <span className="ui-badge ui-badge-line ui-badge-plain ui-push">{count}</span>
      </div>
      <ul className="ui-rows">
        {items.map((d) => (
          <DocRow key={d.docType} doc={d} upload={uploads[d.docType]} actions={actions} />
        ))}
      </ul>
    </section>
  );

  return (
    <PortalShell active="documents" lead={initial.lead}>
      <div className="ui-grid-main-side">
        <div className="ui-stack">
          <section className="ui-card ui-card-pad ui-docs-head ui-rise">
            <div>
              <div className="ui-kicker">{t('documents.kicker')}</div>
              <h1 className="ui-h1 ui-pane-title" style={{ maxWidth: '22ch' }}>
                {t('documents.title')}
              </h1>
              <p className="ui-lede" style={{ maxWidth: '52ch' }}>
                {t('documents.intro')}
              </p>
              <div className="ui-docs-progress">
                <span className="ui-meter">
                  <span style={{ width: `${percent}%` }} />
                </span>
                <span className="ui-docs-count">{t('documents.received', { done: received, total })}</span>
              </div>
            </div>
            <div className="ui-hide-sm">
              <ProgressRing percent={percent} size={112} stroke={9} tone="light" />
            </div>
          </section>

          {todo.length > 0 && <div className="ui-rise-2">{listCard('pt-docs-todo', t('documents.todo'), t('documents.todoCount', { count: todo.length }), todo, 'todo')}</div>}
          {got.length > 0 && <div className="ui-rise-3">{listCard('pt-docs-got', t('documents.got'), t('documents.gotCount', { count: got.length }), got, 'got')}</div>}
        </div>

        <aside className="ui-card ui-submit ui-rise-2">
          <div className="ui-submit-top">
            <div className="ui-kicker">{submitted ? t('status.application_submitted') : t('documents.submit.kicker')}</div>
            <p>{submitted ? t('documents.submit.submitted') : t(`documents.submit.lines.${submitLine}`)}</p>
          </div>
          <div className="ui-submit-body">
            {submitted ? (
              <Link href="/portal" className="ui-btn ui-btn-primary ui-btn-lg ui-btn-block">
                {t('documents.submit.backToCase')}
                <IconArrow size={18} />
              </Link>
            ) : (
              <>
                <button type="button" className="ui-btn ui-btn-gold ui-btn-lg ui-btn-block" onClick={submit} disabled={!applicationComplete}>
                  <IconSend size={18} />
                  {t('documents.submit.button')}
                </button>
                {applicationComplete && <p className="ui-small ui-submit-hint">{t('documents.submit.hint')}</p>}
                {submitFailed && (
                  <p role="alert" className="ui-error" style={{ textAlign: 'center' }}>
                    {t('documents.submit.error')}
                  </p>
                )}
                <div className="ui-submit-links">
                  <Link href="/portal/application" className="ui-btn ui-btn-quiet ui-btn-sm">
                    <IconBack size={16} />
                    {t('documents.submit.backToApplication')}
                  </Link>
                  <Link href="/portal" className="ui-btn ui-btn-quiet ui-btn-sm">
                    <IconHome size={16} />
                    {t('documents.submit.saveAndReturn')}
                  </Link>
                </div>
              </>
            )}
          </div>
          <ul className="ui-submit-facts">
            <li>
              <IconFile size={16} />
              <span>{t('documents.submit.formats')}</span>
            </li>
            <li>
              <IconShield size={16} />
              <span>{t('documents.submit.privacy')}</span>
            </li>
          </ul>
        </aside>
      </div>

      <input ref={fileInput} type="file" hidden accept={FILE_ACCEPT} onChange={onFile} tabIndex={-1} aria-hidden="true" />
      <input ref={cameraInput} type="file" hidden accept={CAMERA_ACCEPT} capture="environment" onChange={onFile} tabIndex={-1} aria-hidden="true" />
      <span role="status" aria-live="polite" className="pt-sr-only">
        {announcement && `${t('documents.tags.received')}: ${announcement}`}
      </span>
    </PortalShell>
  );
}
