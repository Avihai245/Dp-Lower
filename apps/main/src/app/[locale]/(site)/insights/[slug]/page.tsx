import { ARTICLE_SLUGS, getArticle } from '@dpl/i18n';
import { hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { ArticleView } from '@/components/insights/ArticleView';
import { routing } from '@/i18n/routing';
import { articleDescription, articleJsonLd } from '@/lib/jsonld';
import { JsonLd, pageMetadata, SITE_URL } from '@/lib/seo';

type Props = { params: Promise<{ locale: string; slug: string }> };

/** 8 articles in both languages, prerendered. */
export function generateStaticParams() {
  return routing.locales.flatMap((locale) => ARTICLE_SLUGS.map((slug) => ({ locale, slug })));
}

const SHARE_IMAGE = '/images/Decker-Pex-Levi-Team-scaled.jpg.webp';

export async function generateMetadata({ params }: Props) {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const article = getArticle(locale, slug);
  if (!article) return {};
  const t = await getTranslations({ locale, namespace: 'seo' });
  return pageMetadata({
    locale,
    path: `/insights/${slug}`,
    title: `${article.title} | ${t('brand')}`,
    description: articleDescription(article),
    image: SHARE_IMAGE,
    type: 'article',
  });
}

export default async function ArticlePage({ params }: Props) {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const article = getArticle(locale, slug);
  if (!article) notFound();

  const t = await getTranslations({ locale, namespace: 'seo' });
  const jsonLd = articleJsonLd({
    origin: SITE_URL,
    locale,
    article,
    crumbs: [
      { name: t('pages.home.name'), path: '/' },
      { name: t('pages.insights.name'), path: '/insights' },
      { name: article.title, path: `/insights/${slug}` },
    ],
    image: `${SITE_URL}${SHARE_IMAGE}`,
  });

  return (
    <>
      <JsonLd data={jsonLd} />
      <ArticleView article={article} locale={locale} />
    </>
  );
}
