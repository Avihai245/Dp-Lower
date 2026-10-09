'use client';

import type { ReactNode } from 'react';
import { usePathname } from '@/i18n/navigation';

/**
 * The band at the foot of the page: the lead form everywhere, except on the contact page, which closes with the
 * "One more step" band instead (it has a form of its own).
 */
export function LeadOrClose({ lead, close }: { lead: ReactNode; close: ReactNode }) {
  return usePathname() === '/contact' ? close : lead;
}
