import { s } from '@dpl/ui';
import type { CSSProperties, ReactNode } from 'react';
import { Logo, Page, SANS } from './ui';

export const AUTH_LABEL = `display: block; ${SANS}; font-size: 12.5px; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; color: #736d64; margin-bottom: 8px`;
export const AUTH_INPUT = `width: 100%; padding: 15px 16px; font-size: 16px; ${SANS}; color: #14202b; border: 1px solid #ece6dc; background: #fff; border-radius: 12px; box-sizing: border-box`;
export const AUTH_KICKER = 'font-size: 12px; font-weight: 600; letter-spacing: 0.16em; text-transform: uppercase; color: #a07a3c; margin-bottom: 16px';
export const AUTH_H1 = "font-family: 'Newsreader', Georgia, serif; font-weight: 400; font-size: 31px; line-height: 1.15; letter-spacing: -0.015em; margin: 0 0 12px";
export const AUTH_BUTTON = `width: 100%; background: #14202b; color: #f8f5f0; ${SANS}; font-weight: 600; padding: 18px; font-size: 15px; letter-spacing: 0.06em; text-transform: uppercase; border-radius: 12px`;
export const HEADER_LINK = `margin-left: auto; background: none; border: 0; padding: 0; ${SANS}; font-size: 13px; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; color: #736d64; cursor: pointer; text-decoration: none`;

/**
 * The frame of the sign-in family of screens (set password, sign in, expired link, unsubscribe): logo and one link in
 * the header, a hairline, and a white card centred on the paper background.
 */
export function AuthShell({ logoAlt, header, width, children, cardStyle }: { logoAlt: string; header: ReactNode; width: number; children: ReactNode; cardStyle?: CSSProperties }) {
  return (
    <Page>
      <div data-pad style={s('max-width: 100%; width: 100%; margin: 0 auto; padding: 22px clamp(20px, 4.6vw, 160px); display: flex; align-items: center; gap: 24px')}>
        <Logo alt={logoAlt} height={34} />
        {header}
      </div>
      <div style={s('height: 1px; background: #ece6dc')} />
      <div data-pad style={s('flex: 1; display: grid; place-items: center; padding: 64px clamp(20px, 4.6vw, 160px)')}>
        <main data-fx-anim style={{ ...s(`width: 100%; max-width: ${width}px; background: #fff; border: 1px solid #ece6dc; padding: 42px 38px 36px; animation: qIn 320ms cubic-bezier(0.2,0,0,1) both`), ...cardStyle }}>
          {children}
        </main>
      </div>
    </Page>
  );
}
