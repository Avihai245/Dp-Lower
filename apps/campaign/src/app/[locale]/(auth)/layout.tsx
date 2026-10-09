import type { ReactNode } from 'react';

// Owned by the auth worker: wrap with <ClientMessages namespaces={[...]}> and add the page chrome here.
export default function AuthLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
