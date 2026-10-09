import type { Locale } from '@dpl/core';
import { getContent } from '@dpl/i18n';
import { s } from '@dpl/ui';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { ReactNode } from 'react';
import { preload } from 'react-dom';
import { ClientMessages } from '@/components/ClientMessages';
import { A11yInit } from '@/components/shell/A11yInit';
import { CloseBand } from '@/components/shell/CloseBand';
import { FloatingWidgets } from '@/components/shell/FloatingWidgets';
import { Footer } from '@/components/shell/Footer';
import { Header, type HeaderItem } from '@/components/shell/Header';
import { LeadBand } from '@/components/shell/LeadBand';
import { LeadOrClose } from '@/components/shell/LeadOrClose';
import { SkipLink } from '@/components/shell/SkipLink';
import { UtilityBar } from '@/components/shell/UtilityBar';
import { campaignUrl } from '@/lib/campaign';
import { buildMenus, NAV, serviceGroups } from '@/lib/nav';
import '@/styles/shell.css';

/**
 * Shell of every page of the site: skip link, utility bar, sticky header with its mega menus, the page itself, the lead
 * band (or the "One more step" band on the contact page), the footer and the floating widgets. Pages render inside
 * <main id="dpl-main">, so they must not render a <main> of their own. #dpl-page is what the accessibility widget zooms
 * and filters; the floating widgets are deliberately outside it.
 */
export default async function SiteLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const { locale: requested } = await params;
  setRequestLocale(requested);
  const locale = requested as Locale; // already validated by the [locale] layout
  const t = await getTranslations('site');
  const content = getContent(locale);
  preload('/images/DPL_logo.webp', { as: 'image', fetchPriority: 'high' });

  const portalHref = campaignUrl(locale, 'sign-in');
  const items: HeaderItem[] = NAV.map((n) => ({ key: n.key, label: t(`nav.${n.key}`), href: n.href, menu: n.menu }));
  const menus = buildMenus(
    content,
    {
      title: (m) => t(`mega.${m}.title`),
      lede: (m) => t(`mega.${m}.lede`),
      cta: (m) => t(`mega.${m}.cta`),
      item: (m, id) => ({ name: t(`mega.${m}.items.${id}.name`), note: t(`mega.${m}.items.${id}.note`) }),
    },
    portalHref,
  );

  return (
    <ClientMessages namespaces={['site', 'a11y']}>
      <A11yInit />
      <div style={s("background: #f8f5f0; color: #23292f; font-family: 'Manrope', system-ui, sans-serif; -webkit-font-smoothing: antialiased")}>
        <SkipLink />
        <div id="dpl-page">
          <UtilityBar />
          <Header
            logoAlt={t('brand.logoAlt')}
            navLabel={t('nav.label')}
            menuLabel={t('nav.menu')}
            items={items}
            menus={menus}
            portal={{ label: t('nav.portal'), href: portalHref }}
            consult={{ label: t('nav.consult'), href: '/contact' }}
            groups={serviceGroups(content.services)}
          />
          <main id="dpl-main" tabIndex={-1}>
            {children}
          </main>
          <LeadOrClose lead={<LeadBand />} close={<CloseBand />} />
          <Footer locale={locale} />
        </div>
        <FloatingWidgets />
      </div>
    </ClientMessages>
  );
}
