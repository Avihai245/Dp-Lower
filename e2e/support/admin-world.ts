import { randomUUID } from 'node:crypto';
import { bootstrapStaff, type StaffRole } from '../../scripts/bootstrap-admin';
import { sessionCookies, type BrowserCookie } from './admin-auth';
import {
  createAuthUser,
  deleteAuthUser,
  eq,
  inList,
  insert,
  remove,
  removeObjects,
  select,
  update,
  uploadObject,
  type Row,
} from './admin-db';

/**
 * The data every CRM end-to-end spec works on: staff accounts in each role, an applicant account (not staff), a few
 * leads in different stages with documents, an inbox, a booking. Everything carries a unique tag (in names and
 * addresses) and `source = 'e2e-admin'`, and `destroyWorld()` removes exactly that world again, so two workers can each
 * have one. The local database is shared with the rest of the team: nothing here touches rows it did not create.
 */

/**
 * The campaign app the specs run against: `ADMIN_BASE_URL` when set, else `CAMPAIGN_URL`, else the `baseURL` of the
 * Playwright project that is running them (playwright.config.ts: the campaign app on port 3001).
 */
export const baseUrlFor = (projectBaseUrl: string | undefined): string => process.env.ADMIN_BASE_URL ?? process.env.CAMPAIGN_URL ?? projectBaseUrl ?? 'http://localhost:3001';
export const SOURCE = 'e2e-admin';
const PASSWORD = 'E2e-Admin-Pass-1!';

export interface Person {
  id: string;
  email: string;
  password: string;
  name: string;
}
export interface TestLead {
  id: string;
  caseRef: string;
  name: string;
  email: string;
  phone: string;
  userId: string | null;
}

export interface World {
  tag: string;
  /** the campaign app under test, no trailing slash */
  baseURL: string;
  admin: Person;
  manager: Person;
  inactive: Person;
  applicant: Person & { leadId: string };
  /** application stage, one document received (with a stored file), one requested */
  alpha: TestLead;
  /** review stage */
  beta: TestLead;
  /** account stage, has a Supabase user */
  gamma: TestLead;
  /** lead stage, no account */
  delta: TestLead;
  cookies: { admin: BrowserCookie[]; manager: BrowserCookie[]; applicant: BrowserCookie[]; inactive: BrowserCookie[] };
  alphaFilePath: string;
  callbackId: string;
  contactId: string;
  bookingStartsAt: string;
  createdAuthUsers: string[];
  storagePaths: string[];
}

const PDF = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n');

async function staffPerson(tag: string, key: string, role: StaffRole, name: string, track: string[]): Promise<Person> {
  const email = `e2e-admin-${key}-${tag}@example.com`;
  const r = await bootstrapStaff({ email, fullName: name, password: PASSWORD, role });
  track.push(r.userId);
  return { id: r.userId, email, password: PASSWORD, name };
}

async function makeLead(
  tag: string,
  key: string,
  name: string,
  fields: Row,
  track: string[],
  opts: { withUser?: boolean } = {},
): Promise<{ lead: TestLead; userId: string | null }> {
  const email = `e2e-admin-${key}-${tag}@example.com`;
  const phone = `+1 718 555 ${String(Math.floor(1000 + Math.random() * 8999))}`;
  const userId = opts.withUser ? await createAuthUser(email, randomUUID(), name) : null;
  if (userId) track.push(userId);
  const [row] = await insert<{ id: string; case_ref: string }>('leads', {
    full_name: name,
    email,
    phone,
    locale: 'en',
    source: SOURCE,
    answers: { country: 'germany', relative: 'grandparent', when: 'between_1933_1945', persecution: 'yes', records: 'one_or_two', residence: 'us' },
    user_id: userId,
    ...fields,
  });
  return { lead: { id: row!.id, caseRef: row!.case_ref, name, email, phone, userId }, userId };
}

export async function createWorld(baseURL: string): Promise<World> {
  const tag = Date.now().toString(36) + Math.floor(Math.random() * 1000).toString(36);
  const createdAuthUsers: string[] = [];
  const storagePaths: string[] = [];
  try {
    return await build(tag, baseURL.replace(/\/+$/, ''), createdAuthUsers, storagePaths);
  } catch (e) {
    await cleanup({ tag, authUsers: createdAuthUsers, storagePaths });
    throw e;
  }
}

async function build(tag: string, baseURL: string, createdAuthUsers: string[], storagePaths: string[]): Promise<World> {
  const admin = await staffPerson(tag, 'admin', 'admin', `E2E Admin ${tag}`, createdAuthUsers);
  const manager = await staffPerson(tag, 'mgr', 'case_manager', `E2E Manager ${tag}`, createdAuthUsers);
  const inactive = await staffPerson(tag, 'off', 'lawyer', `E2E Inactive ${tag}`, createdAuthUsers);
  await update('staff', `user_id=${eq(inactive.id)}`, { active: false });

  // an applicant: a Supabase user with a lead, not staff
  const appEmail = `e2e-admin-applicant-${tag}@example.com`;
  const appUserId = await createAuthUser(appEmail, PASSWORD, `E2E Applicant ${tag}`);
  createdAuthUsers.push(appUserId);
  const [appLead] = await insert<{ id: string }>('leads', {
    full_name: `E2E Applicant ${tag}`,
    email: appEmail,
    source: SOURCE,
    user_id: appUserId,
    stage: 'account',
    status: 'account_created',
  });
  const applicant = { id: appUserId, email: appEmail, password: PASSWORD, name: `E2E Applicant ${tag}`, leadId: appLead!.id };

  const stageSince = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();

  const { lead: alpha } = await makeLead(tag, 'alpha', `Alpha Testperson ${tag}`, {
    route: 'germany',
    stage: 'application',
    status: 'application_incomplete',
    stage_since: stageSince(2),
  }, createdAuthUsers);
  const { lead: beta } = await makeLead(tag, 'beta', `Beta Testperson ${tag}`, {
    route: 'austria',
    stage: 'review',
    status: 'application_submitted',
    stage_since: stageSince(1),
    submitted_at: stageSince(1),
  }, createdAuthUsers);
  const { lead: gamma } = await makeLead(
    tag,
    'gamma',
    `Gamma Testperson ${tag}`,
    { route: 'austria', stage: 'account', status: 'account_created', account_created_at: stageSince(1) },
    createdAuthUsers,
    { withUser: true },
  );
  const { lead: delta } = await makeLead(tag, 'delta', `Delta Testperson ${tag}`, { route: 'germany', stage: 'lead', status: 'enquiry' }, createdAuthUsers);

  // alpha: an application with an ancestor, one received document with a stored file, one requested
  await insert('applications', {
    lead_id: alpha.id,
    data: { anName: 'Karl Alpha', anBirthPlace: 'Vienna, Austria', anDob: '12 / 03 / 1911', fullName: alpha.name, dob: '01 / 01 / 1980', birthPlace: 'Brooklyn', citizenship: 'United States' },
    current_section: 1,
  });
  const alphaFilePath = `${alpha.id}/birth_certificate/${randomUUID()}-birth.pdf`;
  await uploadObject('documents', alphaFilePath, PDF, 'application/pdf');
  storagePaths.push(alphaFilePath);
  await insert('documents', [
    { lead_id: alpha.id, doc_type: 'birth_certificate', status: 'received', file_name: 'birth.pdf', file_path: alphaFilePath, file_size: PDF.length, mime_type: 'application/pdf', uploaded_at: new Date().toISOString(), requested_at: null },
    { lead_id: alpha.id, doc_type: 'marriage_certificates', status: 'requested', file_name: null, file_path: null, file_size: null, mime_type: null, uploaded_at: null, requested_at: new Date().toISOString() },
  ]);

  // inbox
  const [cb] = await insert<{ id: string }>('callback_requests', {
    name: `Callback ${tag}`,
    phone: '+1 212 555 0100',
    locale: 'en',
    source: SOURCE,
    lead_id: alpha.id,
  });
  const [ct] = await insert<{ id: string }>('contact_submissions', {
    kind: 'contact',
    name: `Contact ${tag}`,
    email: alpha.email,
    phone: '+972 50 555 0100',
    matter: 'German citizenship',
    note: `Please call me back ${tag}`,
    locale: 'en',
    page: '/contact',
    source: SOURCE,
    consented_at: new Date().toISOString(),
  });

  // a call booked for beta, far enough ahead and off the weekly template so it never competes for a real slot
  const start = new Date(Date.now() + 40 * 86_400_000);
  start.setUTCHours(1, 0, 0, 0);
  await insert('bookings', { lead_id: beta.id, starts_at: start.toISOString(), ends_at: new Date(start.getTime() + 20 * 60_000).toISOString(), status: 'confirmed', timezone: 'Asia/Jerusalem' });

  const [ca, cm, ci, cp] = await Promise.all([
    sessionCookies(baseURL, admin.email, admin.password),
    sessionCookies(baseURL, manager.email, manager.password),
    sessionCookies(baseURL, inactive.email, inactive.password),
    sessionCookies(baseURL, applicant.email, applicant.password),
  ]);

  return {
    tag,
    baseURL,
    admin,
    manager,
    inactive,
    applicant,
    alpha,
    beta,
    gamma,
    delta,
    cookies: { admin: ca, manager: cm, inactive: ci, applicant: cp },
    alphaFilePath,
    callbackId: cb!.id,
    contactId: ct!.id,
    bookingStartsAt: start.toISOString(),
    createdAuthUsers,
    storagePaths,
  };
}

/** What a (possibly half-built) world needs removed. */
interface Leftovers {
  tag: string;
  authUsers: string[];
  storagePaths: string[];
}

async function cleanup(l: Leftovers): Promise<void> {
  const quiet = async (fn: () => Promise<unknown>) => {
    try {
      await fn();
    } catch (e) {
      console.warn('[e2e cleanup]', e instanceof Error ? e.message : e);
    }
  };
  // only this world's rows: every one of them carries its tag in the name, and another worker's world may be running
  const mine = (column: string) => `${column}=like.${encodeURIComponent(`*${l.tag}*`)}&source=${eq(SOURCE)}`;
  const leads = await select<{ id: string }>('leads', `${mine('full_name')}&select=id`).catch(() => []);
  const leadIds = leads.map((x) => x.id);
  if (leadIds.length) await quiet(() => remove('events', `lead_id=${inList(leadIds)}`));
  await quiet(() => remove('callback_requests', mine('name')));
  await quiet(() => remove('contact_submissions', mine('name')));
  // leads cascade to documents, notes, activity, applications and bookings
  await quiet(() => remove('leads', mine('full_name')));
  await quiet(() => removeObjects('documents', l.storagePaths));
  // the availability specs remove the weekly-template rows they add (each spec owns its own weekday and times)
  await quiet(() => remove('availability_exceptions', `reason=like.${encodeURIComponent(`e2e ${l.tag}%`)}`));
  for (const id of l.authUsers) await quiet(() => deleteAuthUser(id));
}

export const destroyWorld = (w: World): Promise<void> => cleanup({ tag: w.tag, authUsers: w.createdAuthUsers, storagePaths: w.storagePaths });
