'use client';

import { s, x } from '@dpl/ui';
import { useLocale } from 'next-intl';
import { type KeyboardEvent, type RefObject } from 'react';
import { Link } from '@/i18n/navigation';
import type { MegaMenu as MegaMenuModel } from '@/lib/nav';

interface Props {
  id: string;
  menu: MegaMenuModel;
  panelRef: RefObject<HTMLDivElement | null>;
  /** a link was chosen: the header closes the menu */
  onNavigate: () => void;
  /** Escape: close the menu and give focus back to the entry that opened it */
  onEscape: () => void;
  /** ArrowUp on the first link: back to the entry that opened the menu */
  onLeaveTop: () => void;
}

const ITEM =
  "display: flex; flex-direction: column; gap: 2px; text-align: left; background: transparent; border: 0; border-bottom: 1px solid #ece6dc; padding: 11px 2px; cursor: pointer; font-family: 'Manrope', system-ui, sans-serif; line-height: normal; text-decoration: none; transition: background 160ms ease";

/**
 * The panel under the header for one menu: title, lede and a call to action on the left, the links in three columns on
 * the right. Arrow keys / Home / End move between the links, Escape closes the menu.
 */
export function MegaMenu({ id, menu, panelRef, onNavigate, onEscape, onLeaveTop }: Props) {
  const rtl = useLocale() === 'he';

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const links = Array.from(panelRef.current?.querySelectorAll<HTMLElement>('[data-mega-link]') ?? []);
    if (!links.length) return;
    const at = links.indexOf(document.activeElement as HTMLElement);
    const forward = rtl ? 'ArrowLeft' : 'ArrowRight';
    const back = rtl ? 'ArrowRight' : 'ArrowLeft';
    let next = -1;
    switch (e.key) {
      case 'Escape':
        e.preventDefault();
        onEscape();
        return;
      case 'ArrowDown':
      case forward:
        next = at < 0 ? 0 : Math.min(links.length - 1, at + 1);
        break;
      case 'ArrowUp':
      case back:
        if (at <= 0) {
          if (e.key === 'ArrowUp') {
            e.preventDefault();
            onLeaveTop();
          }
          return;
        }
        next = at - 1;
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = links.length - 1;
        break;
      default:
        return;
    }
    e.preventDefault();
    links[next]?.focus();
  }

  return (
    <div
      id={id}
      ref={panelRef}
      role="group"
      aria-label={menu.title}
      data-mega
      onKeyDown={onKeyDown}
      style={s('border-top: 1px solid #ece6dc; background: #f8f5f0; animation: fadeIn 160ms ease both')}
    >
      <div
        data-pad
        style={s('margin: 0 auto; padding: 30px clamp(20px, 4.6vw, 120px) 34px; display: grid; grid-template-columns: minmax(0, 0.9fr) minmax(0, 2.1fr); gap: clamp(24px, 4vw, 72px)')}
      >
        <div>
          <div style={s("font-family: 'Newsreader', Georgia, serif; font-size: 26px; line-height: 1.15; color: #14202b; margin-bottom: 10px")}>
            {menu.title}
          </div>
          <p style={s('font-size: 14.5px; line-height: 1.6; color: #736d64; margin: 0 0 18px; max-width: 34ch')}>{menu.lede}</p>
          <Link
            href={menu.ctaHref}
            onClick={onNavigate}
            data-mega-link
            data-linkbtn
            {...x(
              "display: inline-block; line-height: normal; text-decoration: none; background: none; border: 0; padding: 0; font-family: 'Manrope', system-ui, sans-serif; font-size: 15.5px; font-weight: 600; color: #7a5c2c; cursor: pointer; border-bottom: 1px solid #ded7ca",
              { hover: 'border-bottom-color: #7a5c2c' },
            )}
          >
            {menu.cta}
          </Link>
        </div>
        <div data-mega-cols style={s('display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 4px 28px')}>
          {menu.items.map((item) => {
            const inner = (
              <>
                <span style={s('font-size: 15.5px; font-weight: 600; color: #14202b')}>{item.name}</span>
                <span style={s('font-size: 13px; color: #736d64')}>{item.note}</span>
              </>
            );
            const props = { 'data-mega-link': true, onClick: onNavigate, ...x(ITEM, { hover: 'background: #efe9df' }) };
            return item.external ? (
              <a key={item.name + item.href} href={item.href} {...props}>
                {inner}
              </a>
            ) : (
              <Link key={item.name + item.href} href={item.href} {...props}>
                {inner}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
