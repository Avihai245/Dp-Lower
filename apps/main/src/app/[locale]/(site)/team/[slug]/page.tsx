import { TEAM_SLUGS, absoluteUrl, getMember } from '@dpl/i18n';
import type { Metadata } from 'next';
import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { AttorneyPage, practiceAreasOf } from '@/components/pages/AttorneyPage';
import { cut, teamStaticParams } from '@/components/pages/team';
import { routing } from '@/i18n/routing';
import { JsonLd, SITE_URL, breadcrumbJsonLd, pageMetadata } from '@/lib/seo';

type Props = { params: Promise<{ locale: string; slug: string }> };

/** Every team member in every language is generated at build time; anything else is a 404. */
export const dynamicParams = false;

export function generateStaticParams() {
  return teamStaticParams(routing.locales, TEAM_SLUGS);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const member = getMember(locale, slug);
  if (!member) return {};
  const t = await getTranslations({ locale, namespace: 'pages' });
  const role = member.role.replace(' · ', ', ');
  const meta = pageMetadata({
    locale,
    path: `/team/${slug}`,
    type: 'profile',
    image: member.photo,
    title: t('meta.attorney.title', { name: member.name, role }),
    // a one-line bio ("Leads the North America team.") is too thin for a search snippet on its own
    description: cut(
      member.bio && member.bio.length >= 60
        ? member.bio
        : [t('meta.attorney.fallbackDescription', { name: member.name, role: member.role, dept: member.dept }), member.bio].filter(Boolean).join(' '),
      158,
    ),
  });
  // pageMetadata() writes og:type "website" for everything but articles; a person's page is a profile, as in the prototype
  return { ...meta, openGraph: { ...meta.openGraph, type: 'profile' } };
}

export default async function Attorney({ params }: Props) {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const member = getMember(locale, slug);
  if (!member) notFound();
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: 'pages' });

  const url = absoluteUrl(SITE_URL, locale, `/team/${member.slug}`);
  const areas = practiceAreasOf(locale, member.slug).map((service) => service.name);
  const person = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    '@id': `${url}#person`,
    name: member.name,
    jobTitle: member.role,
    // refers to the firm's @id as the prototype does; the site layout emits the firm's LegalService data on every page
    worksFor: { '@id': `${SITE_URL}/#firm` },
    image: member.photo ? `${SITE_URL}${member.photo}` : undefined,
    sameAs: member.linkedin ? [member.linkedin] : undefined,
    knowsAbout: areas.length ? areas : undefined,
    url,
  };

  return (
    <>
      <JsonLd data={person} />
      <JsonLd
        data={breadcrumbJsonLd(locale, [
          { name: t('breadcrumbs.home'), path: '/' },
          { name: t('breadcrumbs.team'), path: '/team' },
          { name: member.name, path: `/team/${member.slug}` },
        ])}
      />
      <AttorneyPage locale={locale} member={member} />
    </>
  );
}
