'use client';
import type { ApplicationData } from '@dpl/core';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

/** Quiet time after the last keystroke before the answers are sent. */
export const AUTOSAVE_DELAY_MS = 700;
const RETRY_DELAYS_MS = [2000, 5000, 15000];

interface Options {
  initialValues: ApplicationData;
  initialSection: number;
  /** the application was submitted elsewhere (another tab): the server refuses further saves */
  onLocked: () => void;
}

/**
 * Autosave for the application form: the answers live in React state while the person types; changed fields are sent
 * to PUT /api/portal/application once typing pauses, one request at a time (so two saves never race with each other).
 * A failed save keeps the changes and tries again with a growing delay; the person is told while it is failing.
 * `flush()` sends whatever is pending right now (used before leaving the page); when the page is hidden or closed the
 * last changes go out with keepalive.
 */
export function useApplicationAutosave({ initialValues, initialSection, onLocked }: Options) {
  const [values, setValues] = useState<ApplicationData>(initialValues);
  const [section, setSectionState] = useState(initialSection);
  const [status, setStatus] = useState<SaveStatus>('idle');

  const pending = useRef<Record<string, string>>({});
  const sectionRef = useRef(initialSection);
  const sectionDirty = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draining = useRef<Promise<void> | null>(null);
  const failures = useRef(0);
  const lockedRef = useRef(onLocked);
  lockedRef.current = onLocked;
  const mounted = useRef(true);

  const hasPending = () => Object.keys(pending.current).length > 0 || sectionDirty.current;

  const drain = useCallback((): Promise<void> => {
    if (draining.current) return draining.current;
    const run = async () => {
      // always start asynchronously, so that `draining` is set before this can finish (and clear it again)
      await Promise.resolve();
      try {
        while (hasPending()) {
          const data = pending.current;
          const currentSection = sectionRef.current;
          pending.current = {};
          sectionDirty.current = false;
          if (mounted.current) setStatus('saving');
          const res = await api('/api/portal/application', { method: 'PUT', body: { data, currentSection } });
          if (!res.ok) {
            // keep the changes, but never over a newer edit of the same field
            for (const [key, value] of Object.entries(data)) if (!(key in pending.current)) pending.current[key] = value;
            sectionDirty.current = true;
            if (res.status === 409 && res.error === 'already_submitted') {
              pending.current = {};
              sectionDirty.current = false;
              lockedRef.current();
              return;
            }
            failures.current += 1;
            if (mounted.current) setStatus('error');
            const delay = RETRY_DELAYS_MS[Math.min(failures.current - 1, RETRY_DELAYS_MS.length - 1)]!;
            if (timer.current) clearTimeout(timer.current);
            timer.current = setTimeout(() => void drain(), delay);
            return;
          }
          failures.current = 0;
        }
        if (mounted.current) setStatus('saved');
      } finally {
        draining.current = null;
      }
    };
    draining.current = run();
    return draining.current;
  }, []);

  const schedule = useCallback(
    (delay: number) => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void drain(), delay);
    },
    [drain],
  );

  const setField = useCallback(
    (id: string, value: string) => {
      setValues((v) => ({ ...v, [id]: value }));
      pending.current[id] = value;
      schedule(AUTOSAVE_DELAY_MS);
    },
    [schedule],
  );

  /** Moves to another section and remembers it on the server (so the next visit resumes there). */
  const setSection = useCallback(
    (index: number) => {
      sectionRef.current = index;
      sectionDirty.current = true;
      setSectionState(index);
      schedule(0);
    },
    [schedule],
  );

  /** Sends what is pending and waits for it. Resolves true when everything is saved. */
  const flush = useCallback(async (): Promise<boolean> => {
    if (timer.current) clearTimeout(timer.current);
    // a request that is already running may not include the latest edits: wait for it, then send the rest
    if (draining.current) await draining.current;
    if (hasPending()) await drain();
    return !hasPending();
  }, [drain]);

  useEffect(() => {
    mounted.current = true;
    const sendLastChanges = () => {
      if (!hasPending()) return;
      const data = pending.current;
      void fetch('/api/portal/application', {
        method: 'PUT',
        keepalive: true,
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ data, currentSection: sectionRef.current }),
      }).catch(() => undefined);
      pending.current = {};
      sectionDirty.current = false;
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') sendLastChanges();
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', sendLastChanges);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', sendLastChanges);
      mounted.current = false;
      // leaving the page (a link inside the portal): whatever is pending still goes out
      if (timer.current) clearTimeout(timer.current);
      if (hasPending()) void drain();
    };
  }, [drain]);

  return { values, setField, section, setSection, status, flush };
}
