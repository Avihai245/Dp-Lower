import { setRequestLocale } from 'next-intl/server';
import { NotFoundContent, notFoundMetadata } from '@/components/NotFoundContent';

type Props = { params: Promise<{ locale: string }> };

/**
 * What the middleware rewrites every URL that is not a page of the site to, with a 404 status (see lib/known-routes.ts).
 * It is an ordinary server-rendered page, so the 404 has its content, title and language without scripts. Asking for
 * /page-not-found itself is a 404 too: it is not in the list of pages.
 */
export async function generateMetadata({ params }: Props) {
  return notFoundMetadata((await params).locale);
}

export default async function PageNotFound({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <NotFoundContent locale={locale} />;
}
