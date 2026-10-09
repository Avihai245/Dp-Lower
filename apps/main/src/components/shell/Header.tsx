'use client';

import { s, x } from '@dpl/ui';
import type { ServiceGroup } from '@dpl/i18n';
import { useLocale } from 'next-intl';
import { type FocusEvent, type KeyboardEvent, type PointerEvent, useEffect, useRef, useState } from 'react';
import { Link, usePathname } from '@/i18n/navigation';
import { activeNav, type MegaMenu as MegaMenuModel, type MenuKey, type NavKey } from '@/lib/nav';
import { MegaMenu } from './MegaMenu';
import { MobileNav } from './MobileNav';

export interface HeaderItem {
  key: NavKey;
  label: string;
  href: string;
  /** the mega menu this entry opens; null for a plain link */
  menu: MenuKey | null;
}

export interface HeaderProps {
  logoAlt: string;
  navLabel: string;
  menuLabel: string;
  items: HeaderItem[];
  menus: Record<MenuKey, MegaMenuModel>;
  portal: { label: string; href: string };
  consult: { label: string; href: string };
  /** service slug -> group, to light the right entry on a service page */
  groups: Record<string, ServiceGroup>;
}

const MEGA_ID = 'dpl-mega';
const MOBILE_ID = 'dpl-mobile-nav';

const BUTTON_FONT = "font-family: 'Manrope', system-ui, sans-serif";

/**
 * Sticky header: logo, the six entries, client portal and "Free consultation". Five entries open a mega menu, on
 * hover (mouse), click or ArrowDown; it closes on mouse-leave, Escape, a click elsewhere or when focus leaves.
 * Below 720px the entries collapse into the burger menu.
 */
export function Header({ logoAlt, navLabel, menuLabel, items, menus, portal, consult, groups }: HeaderProps) {
  const pathname = usePathname();
  const rtl = useLocale() === 'he';
  const active = activeNav(pathname, (slug) => groups[slug]);

  const [menu, setMenu] = useState<MenuKey | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const rootRef = useRef<HTMLElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const burgerRef = useRef<HTMLButtonElement>(null);
  const triggers = useRef<Array<HTMLElement | null>>([]);
  const focusPanelOnOpen = useRef(false);

  // every navigation starts with both menus closed
  useEffect(() => {
    setMenu(null);
    setMobileOpen(false);
  }, [pathname]);

  // a keyboard user who opened the menu lands on its first link
  useEffect(() => {
    if (menu && focusPanelOnOpen.current) {
      focusPanelOnOpen.current = false;
      panelRef.current?.querySelector<HTMLElement>('[data-mega-link]')?.focus();
    }
  }, [menu]);

  // a click or tap outside the header closes whatever is open
  useEffect(() => {
    if (!menu && !mobileOpen) return;
    const onDown = (e: globalThis.PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setMenu(null);
        setMobileOpen(false);
      }
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [menu, mobileOpen]);

  // widening the window past the burger breakpoint closes the burger list
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 721px)');
    const on = () => mq.matches && setMobileOpen(false);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);

  const triggerOf = (m: MenuKey | null) => triggers.current[items.findIndex((i) => i.menu === m)] ?? null;
  const closeMenu = () => setMenu(null);
  const escapeMenu = () => {
    const opener = triggerOf(menu);
    setMenu(null);
    opener?.focus();
  };

  function onRootKeyDown(e: KeyboardEvent<HTMLElement>) {
    if (e.key !== 'Escape') return;
    if (mobileOpen) {
      setMobileOpen(false);
      burgerRef.current?.focus();
    } else if (menu) {
      escapeMenu();
    }
  }

  function onRootBlur(e: FocusEvent<HTMLElement>) {
    // focus moved to another element outside the header (a plain loss of focus, e.g. a click on text, keeps the menu)
    if (menu && e.relatedTarget instanceof Node && !e.currentTarget.contains(e.relatedTarget)) setMenu(null);
  }

  function onTriggerKeyDown(e: KeyboardEvent<HTMLElement>, index: number) {
    const item = items[index]!;
    const step = (dir: 1 | -1) => {
      e.preventDefault();
      triggers.current[(index + dir + items.length) % items.length]?.focus();
    };
    switch (e.key) {
      case 'ArrowRight':
        step(rtl ? -1 : 1);
        break;
      case 'ArrowLeft':
        step(rtl ? 1 : -1);
        break;
      case 'Home':
        e.preventDefault();
        triggers.current[0]?.focus();
        break;
      case 'End':
        e.preventDefault();
        triggers.current[items.length - 1]?.focus();
        break;
      case 'ArrowDown':
        if (!item.menu) break;
        e.preventDefault();
        if (menu === item.menu) panelRef.current?.querySelector<HTMLElement>('[data-mega-link]')?.focus();
        else {
          focusPanelOnOpen.current = true;
          setMenu(item.menu);
        }
        break;
    }
  }

  const onTriggerEnter = (e: PointerEvent<HTMLElement>, item: HeaderItem) => {
    // hover opens the menus for a mouse; touch and pen go through click so a tap does not open and close at once
    if (e.pointerType === 'mouse') setMenu(item.menu);
  };

  return (
    <header
      ref={rootRef}
      onPointerLeave={(e) => {
        // a mouse leaving the header closes the menu; a finger lifting after a tap does not (touch fires pointerleave on lift)
        if (e.pointerType === 'mouse') closeMenu();
      }}
      onKeyDown={onRootKeyDown}
      onBlur={onRootBlur}
      style={s('position: sticky; top: 0; z-index: 40; background: rgba(248,245,240,0.97); backdrop-filter: saturate(180%) blur(10px); border-bottom: 1px solid #ece6dc')}
    >
      <div data-nav data-pad style={s('margin: 0 auto; padding: 16px clamp(20px, 4.6vw, 120px); display: flex; align-items: center; gap: 32px')}>
        <Link href="/" data-linkbtn style={s('background: none; border: 0; padding: 0; cursor: pointer; display: block; flex: none')}>
          <img
            src="/images/DPL_logo.webp"
            alt={logoAlt}
            width={800}
            height={286}
            decoding="async"
            fetchPriority="high"
            style={s('height: 38px; width: auto; max-width: none; display: block')}
          />
        </Link>

        <nav
          data-navlinks
          aria-label={navLabel}
          style={s('display: flex; gap: 26px; margin-left: auto; min-width: 0; font-size: 15px; font-weight: 500; white-space: nowrap')}
        >
          {items.map((item, i) => {
            const isActive = active === item.key;
            const lit = isActive || (item.menu !== null && menu === item.menu);
            const css = `background: none; border: 0; padding: 4px 0; cursor: pointer; ${BUTTON_FONT}; font-size: 15px; font-weight: ${lit ? 600 : 500}; color: ${lit ? '#14202b' : '#55606b'}; border-bottom: 2px solid ${isActive ? '#a07a3c' : 'transparent'}; transition: color 160ms ease; line-height: normal; text-decoration: none`;
            return item.menu ? (
              <button
                key={item.key}
                type="button"
                ref={(el) => {
                  triggers.current[i] = el;
                }}
                aria-expanded={menu === item.menu}
                aria-controls={MEGA_ID}
                onPointerEnter={(e) => onTriggerEnter(e, item)}
                onClick={(e) => {
                  const opening = menu !== item.menu;
                  // a click that came from the keyboard (detail 0) moves on into the panel it just opened
                  focusPanelOnOpen.current = opening && e.detail === 0;
                  setMenu(opening ? item.menu : null);
                }}
                onKeyDown={(e) => onTriggerKeyDown(e, i)}
                style={s(css)}
              >
                {item.label}
              </button>
            ) : (
              <Link
                key={item.key}
                href={item.href}
                ref={(el) => {
                  triggers.current[i] = el;
                }}
                aria-current={isActive ? 'page' : undefined}
                onPointerEnter={(e) => onTriggerEnter(e, item)}
                onClick={closeMenu}
                onKeyDown={(e) => onTriggerKeyDown(e, i)}
                style={s(css)}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <a
          data-cta
          href={portal.href}
          {...x(
            'font-size: 14px; font-weight: 600; color: #23292f; text-decoration: none; border: 1px solid #d8cfc0; flex: none; padding: 11px 18px; white-space: nowrap; transition: border-color 180ms ease, background 180ms ease; border-radius: 999px',
            { hover: 'border-color: #14202b; background: #efe9df' },
          )}
        >
          {portal.label}
        </a>
        <Link
          data-cta-main
          href={consult.href}
          {...x(
            `background: #14202b; color: #f8f5f0; border: 1px solid #14202b; cursor: pointer; ${BUTTON_FONT}; font-size: 14px; font-weight: 600; letter-spacing: 0.04em; padding: 12px 20px; white-space: nowrap; flex: none; transition: background 180ms ease; border-radius: 999px; line-height: normal; text-decoration: none`,
            { hover: 'background: #22323f' },
          )}
        >
          {consult.label}
        </Link>
        <button
          ref={burgerRef}
          type="button"
          data-burger
          aria-label={menuLabel}
          aria-expanded={mobileOpen}
          aria-controls={MOBILE_ID}
          onClick={() => {
            setMobileOpen((o) => !o);
            setMenu(null);
          }}
          style={s('display: none; background: none; border: 1px solid #d8cfc0; border-radius: 50%; width: 44px; height: 44px; flex: none; cursor: pointer; align-items: center; justify-content: center; color: #14202b')}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
            <path d={mobileOpen ? 'M6 6l12 12M18 6L6 18' : 'M4 7h16M4 12h16M4 17h16'} />
          </svg>
        </button>
      </div>

      {mobileOpen && (
        <MobileNav
          id={MOBILE_ID}
          label={menuLabel}
          items={items.map((i) => ({ key: i.key, label: i.label, href: i.href }))}
          portal={portal}
          onNavigate={() => setMobileOpen(false)}
        />
      )}
      {menu && (
        <MegaMenu
          id={MEGA_ID}
          menu={menus[menu]}
          panelRef={panelRef}
          onNavigate={closeMenu}
          onEscape={escapeMenu}
          onLeaveTop={() => triggerOf(menu)?.focus()}
        />
      )}
    </header>
  );
}
