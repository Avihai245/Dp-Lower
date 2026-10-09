import { NotFoundContent, notFoundMetadata } from '@/components/NotFoundContent';

/**
 * The boundary for a `notFound()` thrown by a page. Unknown URLs never get here: the middleware answers them with the
 * server-rendered /page-not-found, and this stays as the safety net for a page that finds nothing to show.
 */
export const generateMetadata = () => notFoundMetadata();

export default function NotFound() {
  return <NotFoundContent />;
}
