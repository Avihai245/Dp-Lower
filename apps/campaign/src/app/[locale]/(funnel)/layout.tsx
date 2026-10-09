import type { ReactNode } from 'react';

// Owned by the funnel worker: wrap with <ClientMessages namespaces={[...]}> and add the page chrome here.
export default function FunnelLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
