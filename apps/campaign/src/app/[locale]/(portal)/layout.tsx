import type { ReactNode } from 'react';

// Owned by the portal worker: wrap with <ClientMessages namespaces={[...]}> and add the page chrome here.
export default function PortalLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
