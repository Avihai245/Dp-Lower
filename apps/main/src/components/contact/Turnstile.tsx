'use client';

import { useEffect, useRef } from 'react';

/**
 * Cloudflare Turnstile for the public forms. POST /api/contact rejects every submission without a valid token once
 * TURNSTILE_SECRET is set on the server, so a form must send one whenever NEXT_PUBLIC_TURNSTILE_SITE_KEY is configured.
 * Without a site key (local development, tests) nothing is rendered and nothing is loaded.
 */
interface TurnstileApi {
  render(container: HTMLElement, options: Record<string, unknown>): string;
  reset(widgetId?: string): void;
  remove(widgetId?: string): void;
}

/** Cloudflare's script defines `window.turnstile`; read it through a local type rather than augmenting the global Window. */
const api = (): TurnstileApi | undefined => (window as unknown as { turnstile?: TurnstileApi }).turnstile;

export const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? '';

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
let loading: Promise<TurnstileApi> | null = null;

function loadTurnstile(): Promise<TurnstileApi> {
  const ready = api();
  if (ready) return Promise.resolve(ready);
  loading ??= new Promise<TurnstileApi>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      const loaded = api();
      if (loaded) resolve(loaded);
      else reject(new Error('Turnstile did not initialise'));
    };
    script.onerror = () => {
      loading = null;
      reject(new Error('Turnstile could not be loaded'));
    };
    document.head.appendChild(script);
  });
  return loading;
}

/**
 * The challenge runs by itself and stays invisible unless Cloudflare needs the visitor to interact. A token is good for one
 * submission: change `resetSignal` after every attempt to get a fresh one. `onToken(null)` means "no valid token (yet)".
 */
export function Turnstile({
  locale,
  onToken,
  resetSignal,
}: {
  locale: string;
  onToken: (token: string | null) => void;
  resetSignal: number;
}) {
  const box = useRef<HTMLDivElement>(null);
  const widget = useRef<string | undefined>(undefined);
  const callback = useRef(onToken);
  useEffect(() => {
    callback.current = onToken;
  });

  useEffect(() => {
    const container = box.current;
    if (!TURNSTILE_SITE_KEY || !container) return;
    let cancelled = false;
    loadTurnstile()
      .then((turnstile) => {
        if (cancelled) return;
        widget.current = turnstile.render(container, {
          sitekey: TURNSTILE_SITE_KEY,
          language: locale,
          appearance: 'interaction-only',
          callback: (token: string) => callback.current(token),
          'expired-callback': () => callback.current(null),
          'error-callback': () => callback.current(null),
        });
      })
      .catch(() => callback.current(null));
    return () => {
      cancelled = true;
      if (widget.current) api()?.remove(widget.current);
      widget.current = undefined;
    };
  }, [locale]);

  useEffect(() => {
    if (resetSignal > 0 && widget.current) api()?.reset(widget.current);
  }, [resetSignal]);

  return <div ref={box} />;
}
