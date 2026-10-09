import type { ReactNode } from 'react';

// Owned by the landing-A worker: wrap with <ClientMessages namespaces={['landing', 'landingMore', 'common']}>.
export default function SiteLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
