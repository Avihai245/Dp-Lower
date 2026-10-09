'use client';

import { s } from '@dpl/ui';
import { Link } from '@/i18n/navigation';
import { LanguageSwitcher } from './LanguageSwitcher';

export interface MobileNavItem {
  key: string;
  label: string;
  href: string;
}

interface Props {
  id: string;
  label: string;
  items: MobileNavItem[];
  portal: { label: string; href: string };
  onNavigate: () => void;
}

/** The full-width list that the burger button opens below 720px: the six header entries, the client portal and the language switch. */
export function MobileNav({ id, label, items, portal, onNavigate }: Props) {
  return (
    <nav
      id={id}
      aria-label={label}
      data-mobile-nav
      style={s('border-top: 1px solid #ece6dc; background: #f8f5f0; padding: 8px 18px 20px; display: flex; flex-direction: column; animation: fadeIn 200ms ease both')}
    >
      {items.map((item) => (
        <Link
          key={item.key}
          href={item.href}
          onClick={onNavigate}
          style={s(
            "display: block; text-align: left; background: none; border: 0; border-bottom: 1px solid #ece6dc; padding: 15px 2px; font-family: 'Manrope', system-ui, sans-serif; font-size: 17px; font-weight: 500; color: #14202b; cursor: pointer; text-decoration: none; line-height: normal",
          )}
        >
          {item.label}
        </Link>
      ))}
      <a
        href={portal.href}
        style={s('display: block; margin-top: 16px; text-align: center; border: 1px solid #14202b; padding: 14px; font-size: 15px; font-weight: 600; color: #14202b; text-decoration: none; border-radius: 999px')}
      >
        {portal.label}
      </a>
      {/* the utility bar with the language switch is hidden on phones, so the burger list carries it */}
      <LanguageSwitcher variant="light" />
    </nav>
  );
}
