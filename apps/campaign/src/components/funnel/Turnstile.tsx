'use client';
import { useEffect, useRef } from 'react';

interface TurnstileApi {
  render(el: HTMLElement, options: Record<string, unknown>): string;
  reset(id?: string): void;
  remove(id?: string): void;
}
declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
export const turnstileSiteKey = (): string | undefined => process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || undefined;

function loadScript(): Promise<TurnstileApi | null> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  return new Promise((resolve) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`);
    const script = existing ?? Object.assign(document.createElement('script'), { src: SCRIPT_SRC, async: true, defer: true });
    script.addEventListener('load', () => resolve(window.turnstile ?? null));
    script.addEventListener('error', () => resolve(null));
    if (!existing) document.head.appendChild(script);
  });
}

/**
 * Cloudflare Turnstile for the public lead form, only when NEXT_PUBLIC_TURNSTILE_SITE_KEY is configured (the server
 * verifies the token when TURNSTILE_SECRET is). "interaction-only" keeps it invisible unless a visitor must be asked.
 * A blocked script or a failed challenge yields no token: the form is still submitted and the server decides.
 * `resetKey` changes after a rejected submission, which asks for a fresh token.
 */
export function Turnstile({ onToken, resetKey }: { onToken: (token: string | null) => void; resetKey: number }) {
  const box = useRef<HTMLDivElement>(null);
  const widget = useRef<string | undefined>(undefined);
  const callback = useRef(onToken);
  callback.current = onToken;
  const siteKey = turnstileSiteKey();

  useEffect(() => {
    if (!siteKey) return;
    let cancelled = false;
    void loadScript().then((api) => {
      if (cancelled || !api || !box.current) return;
      widget.current = api.render(box.current, {
        sitekey: siteKey,
        appearance: 'interaction-only',
        callback: (token: string) => callback.current(token),
        'expired-callback': () => callback.current(null),
        'error-callback': () => callback.current(null),
      });
    });
    return () => {
      cancelled = true;
      if (widget.current) window.turnstile?.remove(widget.current);
      widget.current = undefined;
    };
  }, [siteKey]);

  useEffect(() => {
    if (resetKey > 0 && widget.current) window.turnstile?.reset(widget.current);
  }, [resetKey]);

  return siteKey ? <div ref={box} style={{ marginBottom: 16 }} /> : null;
}
