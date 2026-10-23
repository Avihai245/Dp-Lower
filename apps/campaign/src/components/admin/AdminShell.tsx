'use client';

import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { AdminNav, AdminToolbar } from './AdminNav';
import { AdminProvider, type AdminProviderProps } from './AdminProvider';
import { EditDetailsModal } from './EditDetailsModal';
import { RealtimeRefresh } from './RealtimeRefresh';
import { Toasts } from './ui';

/** Page chrome of the CRM: provider, sidebar, filter bar, content area, edit dialog, toasts and the live-update listener. */
export function AdminShell({ children, ...data }: Omit<AdminProviderProps, 'children'> & { children: ReactNode }) {
  return (
    <AdminProvider {...data}>
      <Frame>{children}</Frame>
    </AdminProvider>
  );
}

function Frame({ children }: { children: ReactNode }) {
  const t = useTranslations('admin');
  return (
    <div className="adm adm-app">
      <a href="#admin-main" className="adm-skip">
        {t('a11y.skip')}
      </a>
      <AdminNav />
      <div className="adm-body">
        <AdminToolbar />
        <main id="admin-main" tabIndex={-1} style={{ outline: 'none' }}>
          {children}
        </main>
      </div>
      <EditDetailsModal />
      <Toasts />
      <RealtimeRefresh />
    </div>
  );
}
