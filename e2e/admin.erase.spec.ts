import { randomUUID } from 'node:crypto';
import { createAuthUser, eq, getAuthUser, insert, objectExists, remove, removeObjects, select, uploadObject } from './support/admin-db';
import { expect, openLead, test } from './support/admin-fixtures';
import { SOURCE } from './support/admin-world';
import erase from '../apps/campaign/messages/en/admin.json';

const PDF = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n');

/** A complete applicant: account, file in storage, application documents, a note, a callback, an enquiry, queued events. */
async function seed(tag: string) {
  const email = `e2e-admin-erase-${tag}@example.com`;
  const userId = await createAuthUser(email, randomUUID(), 'Erase Me');
  const [lead] = await insert<{ id: string; case_ref: string }>('leads', {
    full_name: `Erase Me ${tag}`,
    email,
    phone: '+1 718 555 0142',
    source: SOURCE,
    user_id: userId,
    stage: 'review',
    status: 'application_submitted',
  });
  const leadId = lead!.id;
  const path = `${leadId}/passport/${randomUUID()}-passport.pdf`;
  await uploadObject('documents', path, PDF, 'application/pdf');
  await insert('documents', { lead_id: leadId, doc_type: 'passport', status: 'received', file_name: 'passport.pdf', file_path: path, file_size: PDF.length, mime_type: 'application/pdf', uploaded_at: new Date().toISOString() });
  await insert('lead_notes', { lead_id: leadId, body: 'to be erased' });
  await insert('callback_requests', { lead_id: leadId, name: `Erase Me ${tag}`, phone: '+1 718 555 0142' });
  await insert('contact_submissions', { kind: 'contact', name: `Erase Me ${tag}`, email, phone: '+1 718 555 0142' });
  await insert('events', { type: 'lead.created', lead_id: leadId, payload: { lead: { email } } });
  return { leadId, caseRef: lead!.case_ref, email, userId, path };
}

test.describe('deleting an applicant', () => {
  test('a case manager is not offered it; an admin must type the case reference, and then everything is gone', async ({ adminPage: page, managerPage, world }) => {
    const a = await seed(world.tag);
    world.storagePaths.push(a.path); // removed again by the world's clean-up even if the test fails half way
    try {
      // staff who are not admins do not see the button at all
      await openLead(managerPage, a.leadId);
      await expect(managerPage.locator('[data-erase-panel]')).toHaveCount(0);

      await openLead(page, a.leadId);
      await expect(page.locator('[data-erase-panel]')).toBeVisible();
      await page.locator('[data-erase-open]').click();
      const confirm = page.locator('[data-erase-confirm]');
      await expect(confirm).toBeDisabled();
      await page.locator('[data-erase-form] input').fill('DPL-00-0000');
      await expect(confirm).toBeDisabled();
      await page.locator('[data-erase-form] input').fill(a.caseRef.toLowerCase()); // case does not matter
      await expect(confirm).toBeEnabled();
      await confirm.click();

      // back on the list, with the confirmation
      await expect(page).toHaveURL(/\/admin(\?.*)?$/);
      await expect(page.getByText(erase.erase.done.replace('{caseRef}', a.caseRef))).toBeVisible();

      // the lead and everything that carried the person's details
      expect(await select('leads', `id=${eq(a.leadId)}`)).toEqual([]);
      for (const table of ['documents', 'lead_notes', 'activity_log', 'bookings', 'applications', 'events', 'callback_requests']) {
        expect(await select(table, `lead_id=${eq(a.leadId)}`), table).toEqual([]);
      }
      expect(await select('contact_submissions', `email=${eq(a.email)}`)).toEqual([]);
      await expect(getAuthUser(a.userId)).rejects.toThrow();

      // what is kept names no one
      const [logged] = await select<{ case_ref: string; deleted_by: string; storage_objects: number }>('deletion_log', `case_ref=${eq(a.caseRef)}`);
      expect(logged).toMatchObject({ case_ref: a.caseRef, deleted_by: world.admin.id, storage_objects: 1 });
      const [crm] = await select<{ payload: Record<string, unknown> }>('events', `type=${eq('lead.deleted')}&dedupe_key=${eq(`lead.deleted:${a.leadId}`)}`);
      expect(crm!.payload).toMatchObject({ caseRef: a.caseRef, by: world.admin.name });
      expect(JSON.stringify(crm!.payload)).not.toContain(a.email);
      expect(JSON.stringify(crm!.payload)).not.toContain('Erase Me');

      // the file itself is gone from storage, not only its row
      expect(await objectExists('documents', a.path)).toBe(false);
      await remove('deletion_log', `case_ref=${eq(a.caseRef)}`);
      await remove('events', `dedupe_key=${eq(`lead.deleted:${a.leadId}`)}`);
    } finally {
      await removeObjects('documents', [a.path]).catch(() => undefined);
    }
  });
});
