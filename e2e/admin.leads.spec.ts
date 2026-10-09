import { expect, openLead, openList, test } from './support/admin-fixtures';
import { activity, activityAfter, emails, eq, events, eventsAfter, eventually, getAuthUser, getDoc, getLead, insert, remove, select, update } from './support/admin-db';

/**
 * The CRM's lead list, board and lead page against the real database: what staff see, and what every action writes
 * (the row, an activity_log entry by the acting staff member, an outbox event and, where designed, an email).
 */

const stage = async (id: string) => (await getLead(id)).stage;

test.describe('lead list and board', () => {
  test('staff see the leads with the designed columns, counters, filters and search', async ({ managerPage: page, world }) => {
    await openList(page);
    const row = page.locator(`[data-lead-row="${world.alpha.id}"]`);
    await expect(row).toBeVisible();
    await expect(row).toContainText(world.alpha.name);
    await expect(row).toContainText(world.alpha.caseRef);
    await expect(row).toContainText('Karl Alpha · Vienna 1911'); // ancestor from the application
    await expect(row).toContainText('1/8'); // one document received
    await expect(row).toContainText('Application Incomplete'); // status label
    await expect(row).toContainText('Application in progress'); // stage label
    await expect(row).toContainText('United States'); // residence from the quiz answer
    await expect(page.locator('[data-stats]')).toContainText('Need attention');
    await expect(page.locator('[data-stats]')).toContainText('Waiting on applicant');

    // search narrows the list and works across name, case ref, email and ancestor
    const search = page.getByPlaceholder('Search name, case ID, ancestor');
    await search.fill(world.beta.name);
    await expect(page.locator(`[data-lead-row="${world.beta.id}"]`)).toBeVisible();
    await expect(page.locator(`[data-lead-row="${world.alpha.id}"]`)).toHaveCount(0);
    await search.fill(world.alpha.caseRef);
    await expect(page.locator(`[data-lead-row="${world.alpha.id}"]`)).toBeVisible();
    await search.fill('karl alpha');
    await expect(page.locator(`[data-lead-row="${world.alpha.id}"]`)).toBeVisible();
    await search.fill(world.alpha.email);
    await expect(page.locator(`[data-lead-row="${world.alpha.id}"]`)).toBeVisible();
    await search.fill(`no-such-lead-${world.tag}`);
    await expect(page.getByText('No leads match this filter or search.')).toBeVisible();
    await search.fill('');

    // route filters: alpha is German, beta Austrian
    await page.getByRole('button', { name: /^Germany/ }).click();
    await expect(page.locator(`[data-lead-row="${world.alpha.id}"]`)).toBeVisible();
    await expect(page.locator(`[data-lead-row="${world.beta.id}"]`)).toHaveCount(0);
    await page.getByRole('button', { name: /^Austria/ }).click();
    await expect(page.locator(`[data-lead-row="${world.beta.id}"]`)).toBeVisible();
    await expect(page.locator(`[data-lead-row="${world.alpha.id}"]`)).toHaveCount(0);
    // "New" = lead and account stages
    await page.getByRole('button', { name: /^New/ }).click();
    await expect(page.locator(`[data-lead-row="${world.gamma.id}"]`)).toBeVisible();
    await expect(page.locator(`[data-lead-row="${world.delta.id}"]`)).toBeVisible();
    await expect(page.locator(`[data-lead-row="${world.beta.id}"]`)).toHaveCount(0);
    await page.getByRole('button', { name: /^All open/ }).click();
  });

  test('the filter and view are kept in the address bar', async ({ managerPage: page, world }) => {
    await openList(page, '?filter=germany&view=board');
    await expect(page.getByRole('button', { name: /^Germany/ })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('[data-board]')).toBeVisible();
    await expect(page.locator(`[data-lead-card="${world.alpha.id}"]`)).toBeVisible();
    await page.getByRole('tab', { name: 'Table' }).click();
    await expect(page).toHaveURL(/filter=germany/);
    await expect(page).not.toHaveURL(/view=board/);
  });

  test('the board shows the six stage columns and a card moves with its arrow buttons, saved with a log entry and an outbox event', async ({
    adminPage: page,
    world,
  }) => {
    await update('leads', `id=${eq(world.alpha.id)}`, { stage: 'application', status: 'application_incomplete' });
    await openList(page, '?view=board');
    for (const title of ['New lead', 'Account created', 'Application in progress', 'Under review', 'Filed with authority', 'Granted']) {
      await expect(page.locator('[data-board] h3', { hasText: title })).toBeVisible();
    }
    const card = page.locator(`[data-lead-card="${world.alpha.id}"]`);
    await expect(page.locator('[data-board-col="application"]').locator(`[data-lead-card="${world.alpha.id}"]`)).toBeVisible();

    await card.getByRole('button', { name: 'Move to next stage' }).click();
    await expect(page.locator('[data-board-col="review"]').locator(`[data-lead-card="${world.alpha.id}"]`)).toBeVisible();
    await expect.poll(() => stage(world.alpha.id)).toBe('review');

    const log = await activityAfter(world.alpha.id, 'stage_changed');
    expect(log).toHaveLength(1);
    expect(log[0]).toMatchObject({ kind: 'staff', actor_id: world.admin.id, actor_name: world.admin.name, text: 'Stage changed: Application in progress → Under review' });
    expect(log[0]!.meta).toMatchObject({ from: 'application', to: 'review' });
    const ev = await eventsAfter(world.alpha.id, 'stage.changed');
    expect(ev).toHaveLength(1);
    expect(ev[0]!.channel).toBe('crm');
    expect(ev[0]!.payload).toMatchObject({ from: 'application', to: 'review', by: world.admin.name, lead: { id: world.alpha.id, stage: 'review' } });

    await card.getByRole('button', { name: 'Move to previous stage' }).click();
    await expect.poll(() => stage(world.alpha.id)).toBe('application');
    await expect(page.locator('[data-board-col="application"]').locator(`[data-lead-card="${world.alpha.id}"]`)).toBeVisible();
  });

  test('a card can be dragged to another column', async ({ adminPage: page, world }) => {
    await update('leads', `id=${eq(world.gamma.id)}`, { stage: 'account', status: 'account_created' });
    await openList(page, '?view=board');
    const card = page.locator(`[data-lead-card="${world.gamma.id}"]`);
    // drop on the top of the column (its header): on the shared database the other columns can be very tall
    const top = { x: 60, y: 24 };
    await card.dragTo(page.locator('[data-board-col="filed"]'), { targetPosition: top });
    await expect(page.locator('[data-board-col="filed"]').locator(`[data-lead-card="${world.gamma.id}"]`)).toBeVisible();
    await expect.poll(() => stage(world.gamma.id)).toBe('filed');
    expect((await activityAfter(world.gamma.id, 'stage_changed'))[0]!.text).toBe('Stage changed: Account created → Filed with authority');
    expect(await eventsAfter(world.gamma.id, 'stage.changed')).toHaveLength(1);

    // dropping a card on the column it is already in is not a change: no new log entry or event
    await page.locator(`[data-lead-card="${world.gamma.id}"]`).dragTo(page.locator('[data-board-col="filed"]'), { targetPosition: top });
    await page.waitForTimeout(800);
    expect(await stage(world.gamma.id)).toBe('filed');
    expect(await activity(world.gamma.id, 'stage_changed')).toHaveLength(1);
    expect(await events(world.gamma.id, 'stage.changed')).toHaveLength(1);

    // and back to where it came from
    await page.locator(`[data-lead-card="${world.gamma.id}"]`).dragTo(page.locator('[data-board-col="account"]'), { targetPosition: top });
    await expect(page.locator('[data-board-col="account"]').locator(`[data-lead-card="${world.gamma.id}"]`)).toBeVisible();
    await expect.poll(() => stage(world.gamma.id)).toBe('account');
    expect(await activityAfter(world.gamma.id, 'stage_changed', 2)).toHaveLength(2);
  });

  test('a move whose request fails on the way is undone with an error toast (not the error page), and nothing is stored', async ({
    adminPage: page,
    world,
  }) => {
    await update('leads', `id=${eq(world.alpha.id)}`, { stage: 'application', status: 'application_incomplete' });
    await openList(page, '?view=board');
    const inApplication = page.locator('[data-board-col="application"]').locator(`[data-lead-card="${world.alpha.id}"]`);
    await expect(inApplication).toBeVisible();

    // every Server Action request is dropped, as when the connection breaks
    await page.route('**/*', (route) => (route.request().headers()['next-action'] ? route.abort('connectionreset') : route.continue()));
    const before = (await activity(world.alpha.id, 'stage_changed')).length;
    await inApplication.getByRole('button', { name: 'Move to next stage' }).click();
    await expect(page.locator('[data-toasts]')).toContainText('Something went wrong. Please try again.');
    // the optimistic move is taken back: the card is where the database says it is
    await expect(page.locator('[data-board-col="application"]').locator(`[data-lead-card="${world.alpha.id}"]`)).toBeVisible();
    await expect(page.locator('[data-board-col="review"]').locator(`[data-lead-card="${world.alpha.id}"]`)).toHaveCount(0);
    await expect(page.locator('[data-admin-retry]')).toHaveCount(0);
    expect(await stage(world.alpha.id)).toBe('application');
    expect(await activity(world.alpha.id, 'stage_changed')).toHaveLength(before);
    await page.unroute('**/*');
  });
});

test.describe('lead page', () => {
  test('shows the lead as designed and walks between leads inside the current filter', async ({ managerPage: page, world }) => {
    await openList(page, '?filter=germany');
    await page.locator(`[data-lead-row="${world.alpha.id}"]`).getByRole('link', { name: world.alpha.name }).click();
    await expect(page).toHaveURL(new RegExp(`/admin/leads/${world.alpha.id}`));
    await expect(page.locator('h1')).toHaveText(world.alpha.name);
    await expect(page.getByText(world.alpha.caseRef).first()).toBeVisible();
    await expect(page.getByText('Ancestor: Karl Alpha · Vienna 1911')).toBeVisible();
    await expect(page.getByText(/^Lead \d+ of \d+$/)).toBeVisible();

    // six stages, the current one highlighted
    await expect(page.locator('[data-lp-stages] li')).toHaveCount(6);
    await expect(page.locator('[data-lp-stages] li[aria-current="step"]')).toContainText('Application in progress');
    await expect(page.getByText(/^In this stage since (just now|yesterday|.+ ago)$/)).toBeVisible();

    // contact block
    await expect(page.getByRole('link', { name: world.alpha.email })).toHaveAttribute('href', `mailto:${world.alpha.email}`);
    await expect(page.getByRole('link', { name: world.alpha.phone })).toHaveAttribute('href', /^tel:\+1718555/);

    // eligibility answers use the quiz copy
    await expect(page.locator('[data-answers-panel]')).toContainText('Which country is your family connection to?');
    await expect(page.locator('[data-answers-panel]')).toContainText('Germany');
    await expect(page.locator('[data-answers-panel]')).toContainText('My grandparent');
    await expect(page.locator('[data-answers-panel]')).toContainText('United States');

    // the booked call of beta is shown as a chip on beta's page
    await page.getByRole('button', { name: /^Austria/ }).click();
    await page.goto(`/admin/leads/${world.beta.id}`);
    await expect(page.locator('[data-call-chip]')).toBeVisible();

    // previous / next stay inside the filter (germany here: beta, an Austrian lead, is not in it)
    await openLead(page, world.alpha.id);
    await page.goto(`/admin/leads/${world.alpha.id}?filter=germany`);
    const position = await page.getByText(/^Lead \d+ of \d+$/).innerText();
    const total = Number(position.match(/of (\d+)/)![1]);
    const germany = await select('leads', `source=${eq('e2e-admin')}&route=in.(germany,both)&stage=neq.granted&select=id`);
    expect(total).toBeGreaterThanOrEqual(germany.length);
    const next = page.getByRole('link', { name: 'Next lead' });
    const prev = page.getByRole('link', { name: 'Previous lead' });
    const hasNext = (await next.getAttribute('aria-disabled')) !== 'true';
    const hasPrev = (await prev.getAttribute('aria-disabled')) !== 'true';
    expect(hasNext || hasPrev).toBe(true);
    if (hasNext) {
      await next.click();
      await expect(page).toHaveURL(/\/admin\/leads\/[0-9a-f-]{36}\?filter=germany/);
      await expect(page.getByText(new RegExp(`^Lead \\d+ of ${total}$`))).toBeVisible();
    }
    await page.getByRole('link', { name: 'All leads' }).click();
    await expect(page).toHaveURL(/\/admin\?filter=germany/);
  });

  test('case stages: back and forward buttons move the case and are logged', async ({ adminPage: page, world }) => {
    await update('leads', `id=${eq(world.beta.id)}`, { stage: 'review', status: 'application_submitted' });
    await openLead(page, world.beta.id);
    await expect(page.getByRole('button', { name: /Move to Filed with authority/ })).toBeVisible();
    await page.getByRole('button', { name: /Move to Filed with authority/ }).click();
    await expect(page.locator('[data-lp-stages] li[aria-current="step"]')).toContainText('Filed with authority');
    await expect.poll(() => stage(world.beta.id)).toBe('filed');
    await expect(page.getByRole('button', { name: /Move to Granted/ })).toBeVisible();
    await expect(page.locator('[data-activity="stage_changed"]').first()).toContainText('Stage changed: Under review → Filed with authority');
    await expect(page.locator('[data-activity="stage_changed"]').first()).toContainText(world.admin.name);

    await page.getByRole('button', { name: /Back a stage/ }).click();
    await expect(page.locator('[data-lp-stages] li[aria-current="step"]')).toContainText('Under review');
    await expect.poll(() => stage(world.beta.id)).toBe('review');
    // moving to the last stage disables the forward button's label
    await update('leads', `id=${eq(world.beta.id)}`, { stage: 'review' });
  });

  test('the next action does what the card says, logs it and shows "Done"', async ({ adminPage: page, world }) => {
    // lead stage: portal invite -> file-open email
    await openLead(page, world.delta.id);
    await expect(page.locator('[data-next-text]')).toContainText('Invite Delta to open their portal');
    await page.getByRole('button', { name: 'Send portal invite' }).click();
    await expect(page.locator('[data-next-done]')).toContainText(/^Done .*\. Logged in activity\.$/);
    await expect.poll(async () => (await emails(world.delta.id, 'file-open')).length).toBe(1);
    const mail = (await emails(world.delta.id, 'file-open'))[0]!;
    expect(mail.channel).toBe('email');
    expect(mail.payload).toMatchObject({ template: 'file-open', to: { email: world.delta.email } });
    expect((await activity(world.delta.id, 'portal_invite_sent'))[0]).toMatchObject({ kind: 'staff', actor_id: world.admin.id });
    expect((await getLead(world.delta.id)).next_action_done_at).not.toBeNull();

    // account stage: reminder
    await openLead(page, world.gamma.id);
    await expect(page.locator('[data-next-text]')).toContainText('has an account but has not started the application');
    await page.getByRole('button', { name: 'Send reminder' }).click();
    await expect(page.locator('[data-next-done]')).toBeVisible();
    await expect.poll(async () => (await emails(world.gamma.id, 'file-open')).length).toBe(1);

    // application stage with documents open: document reminder naming the missing slots
    await openLead(page, world.alpha.id);
    await expect(page.locator('[data-next-text]')).toContainText('7 documents still open');
    await expect(page.locator('[data-next-text]')).toContainText('Chase Alpha for marriage certificates and the rest');
    await page.getByRole('button', { name: 'Send document reminder' }).click();
    await expect(page.locator('[data-next-done]')).toBeVisible();
    await expect.poll(async () => (await emails(world.alpha.id, 'document-requested')).length).toBe(1);
    const reminder = (await emails(world.alpha.id, 'document-requested'))[0]!;
    expect(((reminder.payload as { subject?: string }).subject ?? '').length).toBeGreaterThan(0);

    // review stage: assign to me
    await update('leads', `id=${eq(world.beta.id)}`, { stage: 'review', owner_id: null, next_action_done_at: null });
    await openLead(page, world.beta.id);
    await page.getByRole('button', { name: 'Assign to me' }).click();
    await expect(page.locator('[data-next-done]')).toBeVisible();
    await expect.poll(async () => (await getLead(world.beta.id)).owner_id).toBe(world.admin.id);
    await expect(page.locator('[data-owner-select]')).toHaveValue(world.admin.id);

    // moving the stage clears the "Done" line for the new stage
    await page.getByRole('button', { name: /Move to Filed with authority/ }).click();
    await expect(page.locator('[data-next-done]')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Send status update' })).toBeVisible();
    await update('leads', `id=${eq(world.beta.id)}`, { stage: 'review', owner_id: null, next_action_done_at: null });
    // alpha's reminder state must not leak into later tests
    await update('leads', `id=${eq(world.alpha.id)}`, { next_action_done_at: null });
    await update('leads', `id=${eq(world.gamma.id)}`, { next_action_done_at: null });
    await update('leads', `id=${eq(world.delta.id)}`, { next_action_done_at: null });
  });

  test('moving to review from the next-action card when every document is in', async ({ adminPage: page, world }) => {
    await update('leads', `id=${eq(world.delta.id)}`, { stage: 'application', status: 'application_incomplete', next_action_done_at: null });
    const types = ['birth_certificate', 'marriage_certificates', 'emigration_naturalization', 'persecution_proof', 'passport', 'family_tree', 'photo_id', 'other'];
    await insert(
      'documents',
      types.map((t) => ({ lead_id: world.delta.id, doc_type: t, status: 'received', file_name: null, file_path: null, file_size: null, mime_type: null, uploaded_at: null, requested_at: null })),
    );
    await openLead(page, world.delta.id);
    await expect(page.locator('[data-next-text]')).toContainText('All documents are in');
    await page.getByRole('button', { name: 'Move to review' }).click();
    await expect.poll(() => stage(world.delta.id)).toBe('review');
    await expect(page.locator('[data-lp-stages] li[aria-current="step"]')).toContainText('Under review');
    await update('leads', `id=${eq(world.delta.id)}`, { stage: 'lead', status: 'enquiry' });
    await remove('documents', `lead_id=${eq(world.delta.id)}`);
  });

  test('status shown to the applicant: changing it updates the lead, logs it, emits status.changed and queues the status-update email', async ({
    adminPage: page,
    world,
  }) => {
    await update('leads', `id=${eq(world.beta.id)}`, { status: 'application_submitted' });
    await openLead(page, world.beta.id);
    await expect(page.locator('[data-status-option="application_submitted"]')).toHaveAttribute('aria-pressed', 'true');
    await page.locator('[data-status-option="under_review"]').click();
    await expect(page.locator('[data-status-option="under_review"]')).toHaveAttribute('aria-pressed', 'true');

    await expect.poll(async () => (await getLead(world.beta.id)).status).toBe('under_review');
    const log = await activityAfter(world.beta.id, 'status_changed');
    expect(log[0]).toMatchObject({ kind: 'staff', actor_id: world.admin.id, text: 'Applicant status set to Under Review' });
    const ev = await eventsAfter(world.beta.id, 'status.changed');
    expect(ev).toHaveLength(1);
    expect(ev[0]!.payload).toMatchObject({ from: 'application_submitted', to: 'under_review', lead: { id: world.beta.id, status: 'under_review' } });
    await expect.poll(async () => (await emails(world.beta.id, 'status-update')).length).toBe(1);
    const mail = (await emails(world.beta.id, 'status-update'))[0]!;
    expect(mail.status).toBe('pending');
    expect(mail.payload).toMatchObject({ template: 'status-update', to: { email: world.beta.email, name: world.beta.name }, category: 'transactional' });

    // clicking the status that is already set does nothing (no second email)
    await page.locator('[data-status-option="under_review"]').click();
    await page.locator('[data-status-option="info_required"]').click();
    await expect.poll(async () => (await getLead(world.beta.id)).status).toBe('info_required');
    await expect.poll(async () => (await emails(world.beta.id, 'status-update')).length).toBe(2);
    // an applicant who must send information makes the lead "need attention" and "waiting on applicant"
    await page.getByRole('link', { name: 'All leads' }).click();
    await expect(page.locator(`[data-lead-row="${world.beta.id}"]`)).toContainText("Applicant's reply");
    await update('leads', `id=${eq(world.beta.id)}`, { status: 'application_submitted' });
  });

  test('filed and granted cases: the status update and the closing email', async ({ adminPage: page, world }) => {
    await update('leads', `id=${eq(world.beta.id)}`, { stage: 'filed', status: 'under_review', next_action_done_at: null });
    await openLead(page, world.beta.id);
    await expect(page.locator('[data-next-text]')).toContainText('Filed with the authority. Check for correspondence and keep Beta updated.');
    const before = (await emails(world.beta.id, 'status-update')).length;
    await page.getByRole('button', { name: 'Send status update' }).click();
    await expect(page.locator('[data-next-done]')).toBeVisible();
    await expect.poll(async () => (await emails(world.beta.id, 'status-update')).length).toBe(before + 1);
    expect((await activity(world.beta.id, 'status_update_sent'))[0]).toMatchObject({ kind: 'staff', actor_id: world.admin.id, text: `Status update sent to ${world.beta.email}` });

    // the case is granted elsewhere: the card follows without a reload, and offers the closing email
    await update('leads', `id=${eq(world.beta.id)}`, { stage: 'granted', next_action_done_at: null });
    await expect(page.locator('[data-next-text]')).toContainText('Citizenship granted. Send the certificate instructions and close the case.', { timeout: 15_000 });
    await page.getByRole('button', { name: 'Send closing email' }).click();
    await expect(page.locator('[data-next-done]')).toBeVisible();
    await expect.poll(async () => (await emails(world.beta.id, 'status-update')).length).toBe(before + 2);
    const closing = (await emails(world.beta.id, 'status-update'))[0]!;
    expect(closing.payload).toMatchObject({ template: 'status-update', to: { email: world.beta.email } });
    expect((await activity(world.beta.id, 'closing_email_sent'))[0]).toMatchObject({ kind: 'staff', text: `Closing email sent to ${world.beta.email}` });
    await update('leads', `id=${eq(world.beta.id)}`, { stage: 'review', status: 'application_submitted', next_action_done_at: null });
  });

  test('a next action that no longer matches the case is refused as stale and sends nothing', async ({ adminPage: page, world }) => {
    await update('leads', `id=${eq(world.gamma.id)}`, { stage: 'account', status: 'account_created', next_action_done_at: null });
    await openLead(page, world.gamma.id);
    const base = (await emails(world.gamma.id, 'file-open')).length;
    const captured: { url: string; headers: Record<string, string>; body: string }[] = [];
    page.on('request', (r) => {
      const h = r.headers();
      if (r.method() === 'POST' && h['next-action']) captured.push({ url: r.url(), headers: h, body: r.postData() ?? '' });
    });
    await page.getByRole('button', { name: 'Send reminder' }).click();
    await expect(page.locator('[data-next-done]')).toBeVisible();
    await expect.poll(async () => (await emails(world.gamma.id, 'file-open')).length).toBe(base + 1);
    expect(captured.length).toBeGreaterThan(0);
    const click = captured[0]!;

    // the case moves on (stage application), then the same "Send reminder" request arrives again
    await update('leads', `id=${eq(world.gamma.id)}`, { stage: 'application', next_action_done_at: null });
    const cookie = (await page.context().cookies()).map((c) => `${c.name}=${c.value}`).join('; ');
    const replay = await page.request.post(click.url, {
      headers: { 'next-action': click.headers['next-action']!, 'content-type': click.headers['content-type'] ?? 'text/plain;charset=UTF-8', cookie, origin: world.baseURL },
      data: click.body,
    });
    expect(await replay.text()).toMatch(/"ok":false,"error":"stale"/);
    expect(await emails(world.gamma.id, 'file-open')).toHaveLength(base + 1);
    await update('leads', `id=${eq(world.gamma.id)}`, { stage: 'account', next_action_done_at: null });
  });

  test('a Server Action refreshes the list data in the layout even when live updates are unavailable', async ({ adminPage: page, world }) => {
    // the Realtime socket never connects: only the action itself can bring the new data
    await page.routeWebSocket(/realtime/, (ws) => ws.close());
    await update('leads', `id=${eq(world.beta.id)}`, { status: 'application_submitted', stage: 'review' });
    await page.goto(`/admin/leads/${world.beta.id}`);
    await expect(page.locator('h1')).toHaveText(world.beta.name);
    await expect(page.locator('[data-realtime="subscribed"]')).toHaveCount(0);

    await page.locator('[data-status-option="info_required"]').click();
    await expect(page.locator('[data-status-option="info_required"]')).toHaveAttribute('aria-pressed', 'true');
    // back to the list (client-side): its row comes from the layout's data, which the action had to refresh
    await page.getByRole('link', { name: 'All leads' }).click();
    await expect(page.locator(`[data-lead-row="${world.beta.id}"]`)).toContainText("Applicant's reply", { timeout: 5_000 });
    await update('leads', `id=${eq(world.beta.id)}`, { status: 'application_submitted' });
  });

  test('documents: request, remind, mark received, reject with a note (each emails the applicant and logs it), and view a stored file', async ({
    adminPage: page,
    world,
  }) => {
    await openLead(page, world.alpha.id);
    const row = (type: string) => page.locator(`[data-doc-row][data-doc-type="${type}"]`);
    await expect(page.locator('[data-docs-panel]')).toContainText('1 of 8 received');
    await expect(row('birth_certificate')).toContainText('Received');
    await expect(row('marriage_certificates')).toContainText('Requested');
    await expect(row('passport')).toContainText('Missing');

    // request: missing -> requested, email naming the document, event document.reviewed
    await row('passport').locator('[data-doc-action="request"]').click();
    await expect(row('passport')).toHaveAttribute('data-doc-status', 'requested');
    await expect.poll(async () => (await getDoc(world.alpha.id, 'passport'))?.status).toBe('requested');
    await expect.poll(async () => (await emails(world.alpha.id, 'document-requested')).length).toBeGreaterThanOrEqual(1);
    const requestMail = (await emails(world.alpha.id, 'document-requested'))[0]!;
    expect(requestMail.payload).toMatchObject({ template: 'document-requested', to: { email: world.alpha.email } });
    const reviewed = await eventually(
      () => events(world.alpha.id, 'document.reviewed'),
      (rows) => rows.some((e) => (e.payload as { docType?: string; status?: string }).docType === 'passport' && (e.payload as { status?: string }).status === 'requested'),
    );
    expect(reviewed.length).toBeGreaterThan(0);
    expect((await activityAfter(world.alpha.id, 'doc_requested'))[0]).toMatchObject({ kind: 'staff', actor_id: world.admin.id, text: 'Document requested: Passport' });

    // remind: stays requested, one more email, a log entry
    const before = (await emails(world.alpha.id, 'document-requested')).length;
    await row('passport').locator('[data-doc-action="remind"]').click();
    await expect.poll(async () => (await emails(world.alpha.id, 'document-requested')).length).toBe(before + 1);
    await expect.poll(async () => (await activity(world.alpha.id, 'doc_reminded')).length).toBe(1);

    // mark received (a paper copy): received, logged, event, no email
    const mailsBefore = (await emails(world.alpha.id)).length;
    await row('passport').locator('[data-doc-action="receive"]').click();
    await expect(row('passport')).toHaveAttribute('data-doc-status', 'received');
    await expect.poll(async () => (await getDoc(world.alpha.id, 'passport'))?.status).toBe('received');
    expect((await getDoc(world.alpha.id, 'passport'))!.reviewed_by).toBe(world.admin.id);
    expect((await activityAfter(world.alpha.id, 'doc_received'))[0]!.text).toBe('Document marked received: Passport');
    expect((await emails(world.alpha.id)).length).toBe(mailsBefore);
    await expect(page.locator('[data-docs-panel]')).toContainText('2 of 8 received');

    // reject with a note: needs re-upload, email with the note, event, log
    await row('passport').locator('[data-doc-action="reject"]').click();
    await expect(row('passport').locator('[data-reject-form]')).toBeVisible();
    await row('passport').locator('textarea').fill('The photo page is cut off.');
    await row('passport').locator('[data-reject-confirm]').click();
    await expect(row('passport')).toHaveAttribute('data-doc-status', 'reupload');
    await expect.poll(async () => (await getDoc(world.alpha.id, 'passport'))?.status).toBe('reupload');
    expect((await getDoc(world.alpha.id, 'passport'))!.review_note).toBe('The photo page is cut off.');
    await expect.poll(async () => (await emails(world.alpha.id, 'document-rejected')).length).toBe(1);
    const rejectMail = (await emails(world.alpha.id, 'document-rejected'))[0]!;
    expect(rejectMail.payload).toMatchObject({ template: 'document-rejected', to: { email: world.alpha.email } });
    const rejected = (await eventually(() => events(world.alpha.id, 'document.reviewed'), (rows) => rows.some((e) => (e.payload as { status?: string }).status === 'reupload'))).find(
      (e) => (e.payload as { status?: string }).status === 'reupload',
    )!;
    expect(rejected.payload).toMatchObject({ docType: 'passport', note: 'The photo page is cut off.', by: world.admin.name });
    expect((await activityAfter(world.alpha.id, 'doc_rejected'))[0]!.text).toBe('Document rejected, re-upload requested: Passport');
    // the lead now needs attention
    await expect(page.getByText('Needs attention').first()).toBeVisible();
    await expect(row('passport')).toContainText('The photo page is cut off.');

    // the stored file opens through a short-lived signed URL made on the server
    const view = row('birth_certificate').locator('[data-doc-action="view"]');
    await expect(view).toHaveAttribute('href', `/admin/leads/${world.alpha.id}/documents/birth_certificate`);
    const res = await page.request.get(`/admin/leads/${world.alpha.id}/documents/birth_certificate`, { maxRedirects: 0 });
    expect(res.status()).toBe(302);
    const location = res.headers().location!;
    expect(location).toContain('/storage/v1/object/sign/documents/');
    expect(location).toContain('token=');
    expect(res.headers()['cache-control']).toContain('no-store');
    const file = await fetch(location);
    expect(file.status).toBe(200);
    expect(await file.text()).toContain('%PDF');
    // a slot without a file has nothing to view
    expect((await page.request.get(`/admin/leads/${world.alpha.id}/documents/family_tree`, { maxRedirects: 0 })).status()).toBe(404);
  });

  test('notes: Ctrl+Enter saves, the badge shows in the list, delete removes it', async ({ adminPage: page, world }) => {
    await openLead(page, world.gamma.id);
    const box = page.locator('[data-note-input]');
    await expect(page.locator('[data-note-add]')).toHaveAttribute('aria-disabled', 'true');
    await box.fill(`First line\nSecond line ${world.tag}`);
    await box.press('Control+Enter');
    await expect(page.locator('[data-notes-panel]')).toContainText(`Second line ${world.tag}`);
    await expect(box).toHaveValue('');
    await expect(page.locator('[data-notes-panel]')).toContainText(world.admin.name);
    await expect(page.locator('[data-notes-panel]')).toContainText('1 note');

    const rows = await select('lead_notes', `lead_id=${eq(world.gamma.id)}&select=*`);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ author_id: world.admin.id, author_name: world.admin.name, body: `First line\nSecond line ${world.tag}` });
    expect((await activity(world.gamma.id, 'note_added'))[0]).toMatchObject({ kind: 'staff', actor_id: world.admin.id });

    await page.getByRole('link', { name: 'All leads' }).click();
    await expect(page.locator(`[data-lead-row="${world.gamma.id}"]`).locator('[aria-label="1 note"]')).toBeVisible();

    await openLead(page, world.gamma.id);
    await page.getByRole('button', { name: 'Delete note' }).click();
    await expect(page.locator('[data-notes-panel]')).toContainText('No notes yet.');
    expect(await select('lead_notes', `lead_id=${eq(world.gamma.id)}&select=id`)).toHaveLength(0);
    expect((await activity(world.gamma.id, 'note_deleted')).length).toBe(1);
  });

  test('owner assignment', async ({ adminPage: page, world }) => {
    await update('leads', `id=${eq(world.alpha.id)}`, { owner_id: null });
    await openLead(page, world.alpha.id);
    await page.locator('[data-owner-select]').selectOption(world.manager.id);
    await expect.poll(async () => (await getLead(world.alpha.id)).owner_id).toBe(world.manager.id);
    await expect.poll(async () => (await activity(world.alpha.id, 'owner_assigned'))[0]).toMatchObject({ text: `Assigned to ${world.manager.name}`, kind: 'staff', actor_id: world.admin.id });
    await page.locator('[data-owner-select]').selectOption('');
    await expect.poll(async () => (await getLead(world.alpha.id)).owner_id).toBeNull();
    await expect.poll(async () => (await activity(world.alpha.id, 'owner_cleared')).length).toBe(1);
  });

  test('edit details: updates the lead and the Supabase user, ends old sessions on an email change, and emails a password reset link', async ({
    adminPage: page,
    world,
  }) => {
    await openLead(page, world.gamma.id);
    const before = await getLead(world.gamma.id);
    await page.locator('[data-edit-lead]').click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel('Full name')).toHaveValue(world.gamma.name);

    // validation as designed
    await dialog.getByLabel('Full name').fill('Mono');
    await dialog.getByLabel('Email').fill('not-an-email');
    await dialog.getByRole('button', { name: 'Save changes' }).click();
    await expect(dialog.getByText('Please enter a first and last name.')).toBeVisible();
    await expect(dialog.getByText('Please enter a valid email address.')).toBeVisible();

    const newName = `Gamma Renamed ${world.tag}`;
    const newEmail = `e2e-admin-gamma-renamed-${world.tag}@example.com`;
    await dialog.getByLabel('Full name').fill(newName);
    await dialog.getByLabel('Email').fill(newEmail);
    await dialog.getByLabel('Phone').fill('+49 30 5550 0199');
    await dialog.getByRole('button', { name: 'Save changes' }).click();
    await expect(dialog.getByRole('button', { name: 'Saved' })).toBeVisible();
    await expect(dialog.getByText(/Earlier links and sign-ins for the old address stop working/)).toBeVisible();

    const after = await getLead(world.gamma.id);
    expect(after).toMatchObject({ full_name: newName, email: newEmail, phone: '+49 30 5550 0199', email_verified_at: null });
    expect(after.session_epoch).toBe((before.session_epoch as number) + 1);
    const user = await getAuthUser(world.gamma.userId!);
    expect(user.email).toBe(newEmail);
    expect(user.user_metadata?.full_name).toBe(newName);
    const log = (await activity(world.gamma.id, 'contact_updated'))[0]!;
    expect(log).toMatchObject({ kind: 'staff', actor_id: world.admin.id, text: 'Contact details updated' });
    expect(log.meta).toMatchObject({ fields: ['name', 'email', 'phone'], emailFrom: world.gamma.email, emailTo: newEmail });

    // an address another lead already uses is refused
    await dialog.getByLabel('Email').fill(world.alpha.email);
    await dialog.getByRole('button', { name: 'Save changes' }).click();
    await expect(dialog.getByText('Another lead already uses this email address.')).toBeVisible();
    expect((await getLead(world.gamma.id)).email).toBe(newEmail);
    await dialog.getByLabel('Email').fill(newEmail);

    // password reset link: a recovery link routed through /auth/callback, in the password-reset email
    await dialog.getByRole('button', { name: 'Send password reset link' }).click();
    await expect(dialog.getByText(new RegExp(`Reset link sent to .*${newEmail.replace(/[.+]/g, '\\$&')}.* at \\d\\d:\\d\\d\\. It is valid for one hour\\.`))).toBeVisible();
    await expect.poll(async () => (await emails(world.gamma.id, 'password-reset')).length).toBe(1);
    const mail = (await emails(world.gamma.id, 'password-reset'))[0]!;
    expect(mail.payload).toMatchObject({ template: 'password-reset', to: { email: newEmail }, category: 'transactional' });
    expect((await activity(world.gamma.id, 'password_reset_sent'))[0]).toMatchObject({ kind: 'staff', actor_id: world.admin.id, text: `Password reset link sent to ${newEmail}` });

    // Escape closes the dialog and the page shows the new name
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(page.locator('h1')).toHaveText(newName);
  });

  test('live updates: a change made elsewhere shows up without a reload', async ({ managerPage: page, world }) => {
    await openLead(page, world.beta.id);
    await update('leads', `id=${eq(world.beta.id)}`, { status: 'info_required' });
    await expect(page.locator('[data-status-option="info_required"]')).toHaveAttribute('aria-pressed', 'true', { timeout: 15_000 });

    // a note written by someone else, and a document uploaded by the applicant
    await insert('lead_notes', { lead_id: world.beta.id, author_name: 'Somebody Else', body: `Added elsewhere ${world.tag}` });
    await expect(page.locator('[data-notes-panel]')).toContainText(`Added elsewhere ${world.tag}`, { timeout: 15_000 });
    await insert('documents', { lead_id: world.beta.id, doc_type: 'photo_id', status: 'received', file_name: 'id.jpg' });
    await expect(page.locator('[data-docs-panel]')).toContainText('1 of 8 received', { timeout: 15_000 });

    // and the list updates too
    await page.getByRole('link', { name: 'All leads' }).click();
    await update('leads', `id=${eq(world.beta.id)}`, { full_name: `Beta Updated ${world.tag}` });
    await expect(page.locator(`[data-lead-row="${world.beta.id}"]`)).toContainText(`Beta Updated ${world.tag}`, { timeout: 15_000 });
    await update('leads', `id=${eq(world.beta.id)}`, { full_name: world.beta.name, status: 'application_submitted' });
  });

  test('Hebrew: the CRM is translated and mirrored', async ({ managerPage: page, world }) => {
    await page.goto('/he/admin');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('html')).toHaveAttribute('lang', 'he');
    await expect(page.locator('[data-stats]')).toContainText('דורשים טיפול');
    await expect(page.getByRole('button', { name: /^כל הפתוחים/ })).toBeVisible();
    await expect(page.locator(`[data-lead-row="${world.alpha.id}"]`)).toContainText('הבקשה לא הושלמה');
    await page.goto(`/he/admin/leads/${world.alpha.id}`);
    await expect(page.locator('h1')).toHaveText(world.alpha.name);
    await expect(page.getByText('הפעולה הבאה')).toBeVisible();
    await expect(page.locator('[data-docs-panel]')).toContainText('מסמכים');
    await expect(page.locator('[data-answers-panel]')).toContainText('עם איזו מדינה יש לכם קשר משפחתי?');
    // no horizontal scrolling
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  });
});
