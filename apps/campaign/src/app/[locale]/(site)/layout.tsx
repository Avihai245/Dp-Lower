import type { ReactNode } from 'react';
import { ClientMessages } from '@/components/ClientMessages';
import '@/styles/landing.css';

/**
 * The public landing page. Its Client Components (header, reviews, chat, advisor modal, mobile bar) read these
 * namespaces; `funnel` is here because the chat asks the eligibility questions.
 */
export default function SiteLayout({ children }: { children: ReactNode }) {
  return <ClientMessages namespaces={['landing', 'landingMore', 'common', 'funnel']}>{children}</ClientMessages>;
}
