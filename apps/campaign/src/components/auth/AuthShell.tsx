import { useTranslations } from 'next-intl';
import type { CSSProperties, ReactNode } from 'react';
import { IconCheck, IconClock, IconLock, IconShield } from '../ui/icons';
import '@/styles/app-ui.css';

export const AUTH_LABEL = 'display: block; font-size: 13px; font-weight: 700; color: #1b232b; margin-bottom: 7px';
export const AUTH_INPUT =
  "width: 100%; min-height: 50px; padding: 13px 15px; font-size: 16px; font-family: 'Manrope', system-ui, sans-serif; color: #1b232b; border: 1px solid #d6ccbc; background: #fff; border-radius: 12px; box-sizing: border-box";
export const AUTH_KICKER = 'font-size: 12px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: #7d5e2a; margin-bottom: 12px';
export const AUTH_H1 = "font-family: 'Newsreader', Georgia, serif; font-weight: 400; font-size: 34px; line-height: 1.12; letter-spacing: -0.018em; margin: 0 0 12px";
export const AUTH_BUTTON =
  "width: 100%; min-height: 54px; background: #14202b; color: #fff; border: 1px solid #14202b; font-family: 'Manrope', system-ui, sans-serif; font-weight: 600; padding: 15px 20px; font-size: 15.5px; letter-spacing: 0; text-transform: none; border-radius: 14px; box-shadow: 0 10px 24px -12px rgba(20, 32, 43, 0.6)";
export const HEADER_LINK =
  "margin-left: auto; display: inline-flex; align-items: center; gap: 6px; background: #fff; border: 1px solid #d6ccbc; border-radius: 999px; padding: 8px 15px; font-family: 'Manrope', system-ui, sans-serif; font-size: 13.5px; font-weight: 600; color: #14202b; cursor: pointer; text-decoration: none";

const POINTS = {
  client: [
    { key: 'saved', Icon: IconClock },
    { key: 'private', Icon: IconLock },
    { key: 'updates', Icon: IconCheck },
  ],
  staff: [
    { key: 'twoStep', Icon: IconShield },
    { key: 'private', Icon: IconLock },
    { key: 'log', Icon: IconClock },
  ],
} as const;

/**
 * The frame of the sign-in family of screens (set password, sign in, expired link, unsubscribe, the staff second step):
 * an ink brand panel beside a form card on the paper background; on a phone only the card, under the logo. `audience`
 * picks what the panel says: the portal's clients, or the firm's team (the two-step screens).
 */
export function AuthShell({
  logoAlt,
  header,
  width,
  children,
  cardStyle,
  audience = 'client',
}: {
  logoAlt: string;
  header: ReactNode;
  width: number;
  children: ReactNode;
  cardStyle?: CSSProperties;
  audience?: 'client' | 'staff';
}) {
  const t = useTranslations('auth.brand');
  return (
    <div className="fx ui-auth">
      <aside className="ui-auth-brand" aria-label={t(`${audience}.kicker`)}>
        <img className="ui-auth-brand-logo" src="/images/DPL_logo-sm.webp" alt="" width={320} height={114} decoding="async" />
        <div className="ui-auth-brand-body">
          <div className="ui-kicker">{t(`${audience}.kicker`)}</div>
          <p className="ui-auth-brand-title">{t(`${audience}.title`)}</p>
          <ul className="ui-auth-points">
            {POINTS[audience].map(({ key, Icon }) => (
              <li key={key}>
                <span className="ui-auth-point-icon">
                  <Icon size={17} />
                </span>
                <span>{t(`${audience}.${key}`)}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="ui-auth-secure">
          <IconShield size={15} />
          {t('secure')}
        </div>
      </aside>
      <div className="ui-auth-main">
        <div className="ui-auth-top">
          <img className="ui-auth-logo" src="/images/DPL_logo-sm.webp" alt={logoAlt} width={320} height={114} decoding="async" />
          {header}
        </div>
        <div className="ui-auth-center">
          <main data-fx-anim className="ui-card ui-auth-card" style={{ maxWidth: width + 40, ...cardStyle }}>
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
