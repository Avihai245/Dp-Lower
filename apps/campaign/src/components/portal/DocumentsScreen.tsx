'use client';
import type { DocType } from '@dpl/core';
import { s } from '@dpl/ui';
import { useTranslations } from 'next-intl';
import { useRef, useState, type ChangeEvent, type CSSProperties, type ReactNode, type RefObject } from 'react';
import { api } from '@/lib/api';
import { Link, useRouter } from '@/i18n/navigation';
import { crawlDuration, slotVisual, splitSlots, type SlotVisual } from './model/documents';
import { CAMERA_ACCEPT, FILE_ACCEPT } from './model/file-types';
import { docsSubmitLine, KEY_RECORDS } from './model/progress';
import type { PortalDocument, PortalState } from './model/types';
import { Arrow, PortalLogo, SANS, mix, richTags } from './shared';
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
  const colored = done || err || up;

  const line = err ? '#9a3b2e' : done ? 'var(--color-accent)' : up || req ? '#a07a3c' : 'var(--color-divider)';
  const mark = done ? '✓' : err ? '!' : up ? '↑' : '';
  const markCss =
    `width: 28px; height: 28px; display: grid; place-items: center; flex: none; margin-top: 2px; ${SANS}; font-size: ${colored ? '14px' : '13px'}; border: 1px solid ${line}; background: ${
      done ? 'var(--color-accent)' : err ? '#9a3b2e' : up ? '#a07a3c' : 'transparent'
    }; color: ${colored ? 'var(--color-bg)' : mix(55)}`;
  const rowCss = `display: grid; grid-template-columns: 28px minmax(0, 1fr) auto; gap: 16px; align-items: start; padding: 18px 0; border-bottom: 1px solid var(--color-divider)${err ? '; background: rgba(154,59,46,0.04)' : ''}`;

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
  const tagCss = `font-size: 10.5px; letter-spacing: 0.1em; text-transform: uppercase; ${SANS}; padding: 3px 9px; white-space: nowrap; ${
    done
      ? 'background: var(--color-accent); color: var(--color-bg)'
      : err
        ? 'background: #9a3b2e; color: #f8f5f0'
        : up
          ? 'background: #a07a3c; color: #f8f5f0'
          : req
            ? 'border: 1px solid #a07a3c; color: #7a5c2c'
            : isKey
              ? 'border: 1px solid var(--color-accent); color: var(--color-accent-800)'
              : `border: 1px solid ${mix(30)}; color: ${mix(78)}`
  }`;

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
    ...s('display: block; height: 2px; background: #a07a3c'),
    '--pt-dur': `${crawlDuration(upload?.phase === 'uploading' ? upload.size : 0)}ms`,
  };

  return (
    <li data-doc-row style={s(rowCss)}>
      <span aria-hidden="true" style={s(markCss)}>
        {mark}
      </span>
      <span style={s('min-width: 0')}>
        <span style={s(`display: block; ${SANS}; font-size: 17.5px; line-height: 1.25`)}>{t(`slots.${doc.docType}.title`)}</span>
        <span style={s(`display: block; font-size: 13.5px; line-height: 1.5; color: ${mix(60)}; margin-top: 4px; max-width: 62ch`)}>{t(`slots.${doc.docType}.why`)}</span>
        {fileText !== '' && (
          <span style={s(`display: block; ${SANS}; font-size: 13px; margin-top: 8px; color: ${err ? '#9a3b2e' : mix(70)}`)}>{fileText}</span>
        )}
        {note && (
          <span dir="auto" style={s('display: block; font-size: 13px; line-height: 1.5; margin-top: 4px; color: #9a3b2e')}>
            {note}
          </span>
        )}
        {up && (
          <span style={s('display: block; width: 120px; height: 2px; background: var(--color-neutral-200); margin-top: 8px')}>
            <span className="pt-bar" style={bar} />
          </span>
        )}
      </span>
      <span data-doc-act style={s('display: flex; align-items: center; gap: 14px; justify-content: flex-end')}>
        <span style={s(tagCss)}>{tag}</span>
        {!up && (
          <button
            type="button"
            className="btn btn-secondary pt-camera"
            aria-label={`${t('actions.camera')}: ${t(`slots.${doc.docType}.title`)}`}
            onClick={() => actions.onCamera(doc.docType)}
            style={s('width: 38px; height: 38px; padding: 0; flex: none')}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
              <path d="M4 8.5h3l1.5-2h7l1.5 2h3v10H4z" />
              <circle cx="12" cy="13.5" r="3.2" />
            </svg>
          </button>
        )}
        <button
          type="button"
          className="btn btn-secondary"
          onClick={onAct}
          aria-label={`${actLabel}: ${t(`slots.${doc.docType}.title`)}`}
          style={s('padding: 9px 16px; font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase; white-space: nowrap')}
        >
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

  const sectionHead = (title: string, count: string, strong: boolean) => (
    <div
      style={s(
        `display: flex; align-items: baseline; gap: 12px; padding-bottom: 12px; border-bottom: 1px solid ${strong ? 'var(--color-text)' : 'var(--color-divider)'}`,
      )}
    >
      <span style={s(`${SANS}; font-size: 12px; letter-spacing: 0.16em; text-transform: uppercase${strong ? '' : `; color: ${mix(78)}`}`)}>{title}</span>
      <span style={s(`margin-left: auto; ${SANS}; font-size: 12.5px; color: ${mix(55)}`)}>{count}</span>
    </div>
  );
  const list = (items: PortalDocument[]) => (
    <ul style={s('list-style: none; margin: 0; padding: 0')}>
      {items.map((d) => (
        <DocRow key={d.docType} doc={d} upload={uploads[d.docType]} actions={actions} />
      ))}
    </ul>
  );

  return (
    <div style={s('min-height: 100vh')}>
      <div style={s('max-width: 100%; width: 100%; margin: 0 auto; padding: 20px clamp(20px, 4.6vw, 160px); display: flex; align-items: center; gap: 24px')}>
        <PortalLogo />
        <Link href="/portal" className="btn btn-ghost" style={s('font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase; padding: 6px 10px')}>
          <Arrow /> {t('header.portal')}
        </Link>
        <div style={s(`margin-left: auto; ${SANS}; font-size: 12px; letter-spacing: 0.14em; text-transform: uppercase; color: ${mix(55)}`)}>
          {t('documents.headerLabel')}
        </div>
      </div>
      <div style={s('height: 1px; background: var(--color-divider)')} />

      <div data-pad style={s('max-width: 100%; margin: 0 auto; padding: 48px clamp(20px, 4.6vw, 160px) 80px')}>
        <div data-resp="2" style={s('display: grid; grid-template-columns: minmax(0, 1.15fr) minmax(0, 0.85fr); gap: clamp(28px, 4vw, 64px); align-items: start')}>
          <div>
            <div style={s(`${SANS}; font-size: 12px; letter-spacing: 0.18em; text-transform: uppercase; color: var(--color-accent-700); margin-bottom: 14px`)}>
              {t('documents.kicker')}
            </div>
            <h1 data-h1 style={s('font-size: clamp(32px, 3.4vw, 44px); letter-spacing: -0.022em; margin: 0 0 12px; max-width: 22ch')}>{t('documents.title')}</h1>
            <p style={s(`font-size: 17px; line-height: 1.6; color: ${mix(72)}; margin: 0 0 34px; max-width: 52ch`)}>{t('documents.intro')}</p>

            <div style={s('display: flex; align-items: center; gap: 18px; margin-bottom: 40px; max-width: 520px')}>
              <span style={s(`${SANS}; font-size: 15px; white-space: nowrap`)}>{t('documents.received', { done: received, total })}</span>
              <span style={s('flex: 1; height: 3px; background: var(--color-neutral-200); display: block')}>
                <span style={s(`display: block; height: 3px; background: var(--color-accent); width: ${percent}%; transition: width 600ms cubic-bezier(0.4,0,0.2,1)`)} />
              </span>
            </div>

            {todo.length > 0 && (
              <div style={s('margin-bottom: 40px')}>
                {sectionHead(t('documents.todo'), t('documents.todoCount', { count: todo.length }), true)}
                {list(todo)}
              </div>
            )}
            {got.length > 0 && (
              <div>
                {sectionHead(t('documents.got'), t('documents.gotCount', { count: got.length }), false)}
                {list(got)}
              </div>
            )}
          </div>

          <div className="blueprint" data-sticky style={s('border: 1px solid var(--color-divider); padding: 26px 26px 24px; position: sticky; top: 28px')}>
            <div style={s(`${SANS}; font-size: 11px; letter-spacing: 0.2em; text-transform: uppercase; color: var(--color-accent-700); margin-bottom: 14px`)}>
              {submitted ? t('status.application_submitted') : t('documents.submit.kicker')}
            </div>
            <p style={s(`font-size: 15px; line-height: 1.6; color: ${mix(76)}; margin: 0 0 20px`)}>
              {submitted ? t('documents.submit.submitted') : t(`documents.submit.lines.${submitLine}`)}
            </p>
            {submitted ? (
              <Link href="/portal" className="btn btn-primary" style={s('padding: 17px 32px; font-size: 15px; letter-spacing: 0.08em; text-transform: uppercase')}>
                {t('documents.submit.backToCase')}
              </Link>
            ) : (
              <>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={submit}
                  disabled={!applicationComplete}
                  style={s(`padding: 17px 32px; font-size: 15px; letter-spacing: 0.08em; text-transform: uppercase; opacity: ${applicationComplete ? '1' : '0.4'}`)}
                >
                  {t('documents.submit.button')}
                </button>
                {applicationComplete && (
                  <div style={s(`font-size: 12.5px; line-height: 1.5; color: ${mix(70)}; text-align: center; margin-top: 10px`)}>{t('documents.submit.hint')}</div>
                )}
                {submitFailed && (
                  <div role="alert" style={s('font-size: 13px; line-height: 1.5; color: #9a3b2e; margin-top: 10px')}>
                    {t('documents.submit.error')}
                  </div>
                )}
                <div style={s('display: flex; flex-direction: column; gap: 4px; margin-top: 18px; padding-top: 16px; border-top: 1px solid var(--color-divider)')}>
                  <Link
                    href="/portal/application"
                    className="btn btn-ghost"
                    style={s('font-size: 12.5px; letter-spacing: 0.06em; text-transform: uppercase; justify-content: flex-start')}
                  >
                    <Arrow /> {t('documents.submit.backToApplication')}
                  </Link>
                  <Link
                    href="/portal"
                    className="btn btn-ghost"
                    style={s('font-size: 12.5px; letter-spacing: 0.06em; text-transform: uppercase; justify-content: flex-start')}
                  >
                    {t('documents.submit.saveAndReturn')}
                  </Link>
                </div>
              </>
            )}
            <div
              style={s(
                `display: flex; flex-direction: column; gap: 10px; margin-top: 18px; padding-top: 16px; border-top: 1px solid var(--color-divider); font-size: 12.5px; line-height: 1.55; color: ${mix(58)}`,
              )}
            >
              <span>{t('documents.submit.formats')}</span>
              <span>{t('documents.submit.privacy')}</span>
            </div>
          </div>
        </div>
      </div>

      <input ref={fileInput} type="file" hidden accept={FILE_ACCEPT} onChange={onFile} tabIndex={-1} aria-hidden="true" />
      <input ref={cameraInput} type="file" hidden accept={CAMERA_ACCEPT} capture="environment" onChange={onFile} tabIndex={-1} aria-hidden="true" />
      <span role="status" aria-live="polite" className="pt-sr-only">
        {announcement && `${t('documents.tags.received')}: ${announcement}`}
      </span>
    </div>
  );
}
