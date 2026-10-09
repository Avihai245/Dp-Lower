'use client';

import type { LeadStage } from '@dpl/core';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { usePathname, useRouter } from '@/i18n/navigation';
import { moveStageAction } from '@/app/[locale]/(admin)/admin/actions';
import {
  DEFAULT_FILTER,
  DEFAULT_VIEW,
  computeStats,
  deriveRow,
  filterCounts,
  parseFilter,
  parseView,
  visibleRows,
  type FilterKey,
  type LeadRow,
  type Stats,
  type ViewKey,
} from './model';
import { settle } from './settle';
import type { ActionError, InboxCounts, LeadRowData, StaffOption } from './types';

/**
 * Client state shared by every page of the CRM: the leads (from the server, plus optimistic stage moves), the filters
 * and search, the clock, the lead being edited, toasts and the open "?" popover. The layout feeds `rows` from the
 * server; Realtime events and Server Actions refresh them.
 */

export interface AdminMe {
  id: string;
  name: string;
  role: StaffOption['role'];
}

export interface AdminProviderProps {
  rows: LeadRowData[];
  staff: StaffOption[];
  me: AdminMe;
  inbox: InboxCounts;
  /** server time at render, so the first client render matches the HTML */
  nowIso: string;
  children: ReactNode;
}

interface ToastItem {
  id: number;
  kind: 'info' | 'error';
  text: string;
}

interface AdminContextValue {
  rows: LeadRow[];
  rowsById: Map<string, LeadRow>;
  visible: LeadRow[];
  stats: Stats;
  counts: Record<FilterKey, number>;
  now: Date;
  me: AdminMe;
  staff: StaffOption[];
  inbox: InboxCounts;
  filter: FilterKey;
  view: ViewKey;
  query: string;
  setFilter: (f: FilterKey) => void;
  setView: (v: ViewKey) => void;
  setQuery: (q: string) => void;
  /** '?filter=…&view=…&q=…' for links that should keep the list context (non-default values only) */
  listQuery: string;
  moveStage: (id: string, stage: LeadStage) => Promise<boolean>;
  editingId: string | null;
  editLead: (id: string | null) => void;
  toasts: ToastItem[];
  notify: (text: string, kind?: 'info' | 'error') => void;
  dismissToast: (id: number) => void;
  fail: (error: ActionError) => void;
  helpOpen: string | null;
  setHelpOpen: (key: string | null) => void;
  refresh: () => void;
}

const Ctx = createContext<AdminContextValue | null>(null);

export function useAdmin(): AdminContextValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAdmin must be used inside <AdminProvider>');
  return v;
}

const LIST_PATHS = /^\/admin(\/leads\/[^/]+)?\/?$/;

export function AdminProvider({ rows: serverRows, staff, me, inbox, nowIso, children }: AdminProviderProps) {
  const t = useTranslations('admin');
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  // -- clock -----------------------------------------------------------------------------------------------------
  const [now, setNow] = useState(() => new Date(nowIso));
  useEffect(() => setNow(new Date(nowIso)), [nowIso]);
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  // -- filters and search (state is the truth, the URL mirrors it) ---------------------------------------------------
  const [filter, setFilterState] = useState<FilterKey>(() => parseFilter(params.get('filter')));
  const [view, setViewState] = useState<ViewKey>(() => parseView(params.get('view')));
  const [query, setQueryState] = useState(() => params.get('q') ?? '');
  const [urlQuery, setUrlQuery] = useState(query);
  useEffect(() => {
    const id = setTimeout(() => setUrlQuery(query), 250);
    return () => clearTimeout(id);
  }, [query]);

  const listQuery = useMemo(() => {
    const p = new URLSearchParams();
    if (filter !== DEFAULT_FILTER) p.set('filter', filter);
    if (view !== DEFAULT_VIEW) p.set('view', view);
    if (urlQuery.trim()) p.set('q', urlQuery.trim());
    const s = p.toString();
    return s ? `?${s}` : '';
  }, [filter, view, urlQuery]);

  // keep the address bar in step without creating history entries or a server round trip
  useEffect(() => {
    if (!LIST_PATHS.test(pathname)) return;
    const url = new URL(window.location.href);
    const next = listQuery;
    if (url.search === next) return;
    window.history.replaceState(window.history.state, '', `${url.pathname}${next}${url.hash}`);
  }, [pathname, listQuery]);

  const onList = /^\/admin\/?$/.test(pathname);
  const setFilter = useCallback(
    (f: FilterKey) => {
      setFilterState(f);
      // the prototype's filter buttons also close an open lead
      if (!onList) router.push('/admin');
    },
    [onList, router],
  );
  const setQuery = useCallback(
    (q: string) => {
      setQueryState(q);
      // searching from the inbox or availability pages takes you to the leads
      if (!LIST_PATHS.test(pathname)) router.push('/admin');
    },
    [pathname, router],
  );
  const setView = useCallback((v: ViewKey) => setViewState(v), []);

  // -- leads: server data + optimistic stage moves -----------------------------------------------------------------
  const [overrides, setOverrides] = useState<Map<string, { stage: LeadStage; since: string }>>(new Map());
  const inFlight = useRef(0);
  useEffect(() => {
    // fresh server data replaces optimistic guesses, unless a move is still on its way
    if (inFlight.current === 0) setOverrides(new Map());
  }, [serverRows]);

  const rows = useMemo(
    () =>
      serverRows.map((d) => {
        const o = overrides.get(d.id);
        return deriveRow(o ? { ...d, stage: o.stage, stageSince: o.since, nextActionDoneAt: null } : d, now);
      }),
    [serverRows, overrides, now],
  );
  const rowsById = useMemo(() => new Map(rows.map((r) => [r.id, r])), [rows]);
  const counts = useMemo(() => filterCounts(rows), [rows]);
  const stats = useMemo(() => computeStats(rows), [rows]);
  const visible = useMemo(() => visibleRows(rows, filter, query), [rows, filter, query]);

  // -- toasts -------------------------------------------------------------------------------------------------------
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const toastId = useRef(0);
  const dismissToast = useCallback((id: number) => setToasts((l) => l.filter((x) => x.id !== id)), []);
  const notify = useCallback(
    (text: string, kind: 'info' | 'error' = 'info') => {
      const id = ++toastId.current;
      setToasts((l) => [...l.slice(-2), { id, kind, text }]);
      setTimeout(() => dismissToast(id), kind === 'error' ? 7000 : 4000);
    },
    [dismissToast],
  );
  const refresh = useCallback(() => router.refresh(), [router]);
  const fail = useCallback(
    (error: ActionError) => {
      notify(t(`toast.error.${error}`), 'error');
      if (error === 'stale' || error === 'not_found') router.refresh();
    },
    [notify, router, t],
  );

  const moveStage = useCallback(
    async (id: string, stage: LeadStage): Promise<boolean> => {
      const current = serverRows.find((r) => r.id === id);
      if (!current || (overrides.get(id)?.stage ?? current.stage) === stage) return true;
      setOverrides((m) => new Map(m).set(id, { stage, since: new Date().toISOString() }));
      inFlight.current += 1;
      try {
        const res = await settle(() => moveStageAction({ leadId: id, stage }));
        if (!res.ok) {
          setOverrides((m) => {
            const n = new Map(m);
            n.delete(id);
            return n;
          });
          fail(res.error);
          return false;
        }
        return true;
      } finally {
        inFlight.current -= 1;
        // the Server Action revalidates; this is the safety net when that did not reach the layout
        if (inFlight.current === 0) router.refresh();
      }
    },
    [serverRows, overrides, fail, router],
  );

  // -- edit modal and help popovers ---------------------------------------------------------------------------------
  const [editingId, setEditingId] = useState<string | null>(null);
  const [helpOpen, setHelpOpen] = useState<string | null>(null);
  useEffect(() => {
    if (!helpOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!(e.target as Element | null)?.closest?.('[data-help]')) setHelpOpen(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setHelpOpen(null);
    };
    document.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [helpOpen]);

  const value: AdminContextValue = {
    rows,
    rowsById,
    visible,
    stats,
    counts,
    now,
    me,
    staff,
    inbox,
    filter,
    view,
    query,
    setFilter,
    setView,
    setQuery,
    listQuery,
    moveStage,
    editingId,
    editLead: setEditingId,
    toasts,
    notify,
    dismissToast,
    fail,
    helpOpen,
    setHelpOpen,
    refresh,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
