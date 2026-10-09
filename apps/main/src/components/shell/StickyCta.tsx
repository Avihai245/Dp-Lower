'use client';

import { s } from '@dpl/ui';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from '@/i18n/navigation';
import { stickyVisible } from '@/lib/shell/sticky';

/**
 * "Talk to a lawyer, free": a floating button that appears once the visitor has scrolled past the hero, steps aside
 * when the lead form is in reach or the chat is open, and takes the visitor to the form (or to the contact page when
 * the page has none).
 */
export function StickyCta({ chatOpen }: { chatOpen: boolean }) {
  const t = useTranslations('site');
  const router = useRouter();
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const update = () => {
      const form = document.getElementById('leadform');
      setVisible(
        stickyVisible({
          scrollY: window.scrollY,
          viewportHeight: window.innerHeight,
          formTop: form ? form.getBoundingClientRect().top : null,
          chatOpen,
        }),
      );
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
    // the pathname decides whether #leadform exists
  }, [chatOpen, pathname]);

  function go() {
    const form = document.getElementById('leadform');
    if (!form) {
      router.push('/contact');
      return;
    }
    const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: form.getBoundingClientRect().top + window.scrollY - 80, behavior: smooth ? 'smooth' : 'auto' });
  }

  return (
    <button
      type="button"
      onClick={go}
      data-float
      tabIndex={visible ? 0 : -1}
      aria-hidden={!visible}
      style={s(
        `position: fixed; right: 22px; bottom: 92px; z-index: 50; display: flex; align-items: center; gap: 10px; border-radius: 40px; background: #c9a45c; color: #14202b; border: 1px solid #c9a45c; cursor: pointer; font-family: 'Manrope', system-ui, sans-serif; font-size: 15px; font-weight: 700; letter-spacing: 0.04em; padding: 14px 22px; box-shadow: 0 10px 30px rgba(20,32,43,0.24); transition: opacity 260ms ease, transform 260ms ease; opacity: ${visible ? 1 : 0}; transform: translateY(${visible ? '0' : '14px'}); pointer-events: ${visible ? 'auto' : 'none'}`,
      )}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" style={{ flex: 'none' }} aria-hidden="true">
        <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .3 1.9.6 2.8a2 2 0 0 1-.5 2.1L8.1 9.7a16 16 0 0 0 6 6l1.1-1.1a2 2 0 0 1 2.1-.5c.9.3 1.8.5 2.8.6a2 2 0 0 1 1.9 2.2z" />
      </svg>
      {t('sticky.label')}
    </button>
  );
}
