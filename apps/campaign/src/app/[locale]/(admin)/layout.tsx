import type { ReactNode } from 'react';

// Owned by the admin worker: wrap with <ClientMessages namespaces={[...]}> and add the page chrome here.
export default function AdminLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
