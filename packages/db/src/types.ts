import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

export type { Database, Json } from './database.types';

type Tables = Database['public']['Tables'];
export type LeadRow = Tables['leads']['Row'];
export type BookingRow = Tables['bookings']['Row'];
export type ApplicationRow = Tables['applications']['Row'];
export type DocumentRow = Tables['documents']['Row'];
export type NoteRow = Tables['lead_notes']['Row'];
export type ActivityRow = Tables['activity_log']['Row'];
export type CallbackRow = Tables['callback_requests']['Row'];
export type ContactSubmissionRow = Tables['contact_submissions']['Row'];
export type EventRow = Tables['events']['Row'];
export type StaffRow = Tables['staff']['Row'];
export type AdminLeadRow = Database['public']['Views']['admin_lead_rows']['Row'];

export type Db = SupabaseClient<Database>;

import type { Json as JsonValue } from './database.types';
/** Writes to NOT NULL jsonb columns need a non-null JSON value. */
export const asJson = (v: unknown) => v as NonNullable<JsonValue>;
