import type { ReactNode } from 'react';

// Owned by the main-1 worker: header, utility bar, footer, lead band, chat, accessibility widget.
export default function SiteLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
