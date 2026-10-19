#!/usr/bin/env node
/**
 * Smoke test of a DEPLOYED system (both sites, optionally the Supabase project behind them). Read-only: it only reads pages
 * and sends a few requests that the sites must refuse, so it creates no lead, booking or account. Run it right after a
 * deploy, from any machine that can reach the sites:
 *
 *   pnpm smoke:live --main https://www.lawoffice.org.il --portal https://euro-passports.com \
 *     [--supabase https://<ref>.supabase.co --anon-key <publishable key>] [--rate-limit]
 *
 * (or MAIN_URL / PORTAL_URL / SUPABASE_URL / SUPABASE_ANON_KEY in the environment; it works against localhost too.)
 * `--rate-limit` sends eight refused requests with different x-real-ip headers to prove that the rate limit cannot be
 * dodged by a visitor who makes up an address (CLIENT_IP_SOURCE, docs/DEPLOYMENT.md section 4b); skip it if you do not
 * want eight entries in the rate-limit table. Exit code 1 when anything fails.
 */
const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const opt = (name, env) => {
  const i = args.indexOf(`--${name}`);
  return (i >= 0 ? args[i + 1] : undefined) ?? (env ? process.env[env] : undefined);
};
const trim = (u) => (u ?? '').replace(/\/+$/, '');
const MAIN = trim(opt('main', 'MAIN_URL'));
const PORTAL = trim(opt('portal', 'PORTAL_URL') ?? opt('campaign', 'CAMPAIGN_URL'));
const SUPABASE = trim(opt('supabase', 'SUPABASE_URL'));
const ANON = opt('anon-key', 'SUPABASE_ANON_KEY');
if (!MAIN || !PORTAL) {
  console.error('usage: pnpm smoke:live --main <firm site url> --portal <portal url> [--supabase <url> --anon-key <key>] [--rate-limit]');
  process.exit(2);
}
const MAIN_ORIGIN = new URL(MAIN).origin;
const PORTAL_ORIGIN = new URL(PORTAL).origin;
const HTTPS = MAIN_ORIGIN.startsWith('https://') && PORTAL_ORIGIN.startsWith('https://');

const UA = 'dpl-smoke/1 (+read-only deploy check)';
async function get(url, init = {}) {
  const res = await fetch(url, { redirect: 'manual', ...init, headers: { 'user-agent': UA, accept: 'text/html,application/json', ...(init.headers ?? {}) } });
  const text = init.method === 'HEAD' ? '' : await res.text();
  return { status: res.status, headers: res.headers, text, url };
}
/** Follows redirects (for pages that may hop, e.g. the visitor-country redirect or www). */
const follow = (url, init = {}) => get(url, { ...init, redirect: 'follow' });
const location = (r, base) => (r.headers.get('location') ? new URL(r.headers.get('location'), base) : null);
const meta = (html, name) => new RegExp(`<meta[^>]+name="${name}"[^>]+content="([^"]*)"`, 'i').exec(html)?.[1] ?? '';

const results = [];
async function check(group, name, fn) {
  try {
    const detail = await fn();
    results.push({ group, name, ok: true, detail: typeof detail === 'string' ? detail : '' });
  } catch (e) {
    results.push({ group, name, ok: false, detail: e instanceof Error ? e.message : String(e) });
  }
}
const expect = (cond, message) => {
  if (!cond) throw new Error(message);
};

// ---- the firm's site ------------------------------------------------------------------------------------------------

await check('firm site', 'home page answers (200, or the visitor-country redirect to /he)', async () => {
  const r = await get(`${MAIN}/`);
  expect([200, 307, 308].includes(r.status), `status ${r.status}`);
  if (r.status !== 200) expect(location(r, MAIN)?.pathname.startsWith('/he'), `redirects to ${r.headers.get('location')}`);
});
for (const path of ['/he', '/services', '/team', '/contact', '/privacy']) {
  await check('firm site', `${path} answers 200`, async () => {
    const r = await follow(`${MAIN}${path}`);
    expect(r.status === 200, `status ${r.status}`);
    expect(/<h1[\s>]/i.test(r.text), 'no <h1>');
  });
}
await check('firm site', 'landing page /apply answers 200 and is indexable', async () => {
  const r = await follow(`${MAIN}/apply`);
  expect(r.status === 200, `status ${r.status}`);
  expect(!/noindex/i.test(meta(r.text, 'robots')), 'noindex on the landing page');
  expect(/rel="canonical"/i.test(r.text), 'no canonical link');
});
await check('firm site', 'the quiz /apply/eligibility answers 200 and is noindex', async () => {
  const r = await follow(`${MAIN}/apply/eligibility`);
  expect(r.status === 200, `status ${r.status}`);
  expect(/noindex/i.test(meta(r.text, 'robots')), 'the quiz is indexable');
});
await check('firm site', 'funnel steps without a lead go back to the start, not to an error', async () => {
  for (const step of ['details', 'booking', 'offer']) {
    const r = await follow(`${MAIN}/apply/${step}`);
    expect(r.status === 200, `/apply/${step}: status ${r.status}`);
  }
});
await check('firm site', 'sitemap.xml lists the landing page; robots.txt points at it', async () => {
  const s = await get(`${MAIN}/sitemap.xml`);
  expect(s.status === 200 && /<loc>[^<]*\/apply<\/loc>/.test(s.text), 'sitemap without /apply');
  const r = await get(`${MAIN}/robots.txt`);
  expect(r.status === 200 && /Sitemap:/i.test(r.text), 'robots.txt without a Sitemap line');
});
await check('firm site', 'security headers', async () => {
  const r = await get(`${MAIN}/`);
  expect(r.headers.get('x-content-type-options') === 'nosniff', 'no X-Content-Type-Options: nosniff');
  expect(/frame-ancestors|sameorigin|deny/i.test(`${r.headers.get('content-security-policy')} ${r.headers.get('x-frame-options')}`), 'framing not restricted');
  expect(!!r.headers.get('content-security-policy'), 'no Content-Security-Policy');
  expect(!r.headers.get('x-powered-by'), 'X-Powered-By is sent');
  if (HTTPS) expect(!!r.headers.get('strict-transport-security'), 'no Strict-Transport-Security on https');
});
await check('firm site', 'the "Client portal" / sign-in links go to the portal app (not to the old address)', async () => {
  const r = await follow(`${MAIN}/`);
  const hrefs = [...r.text.matchAll(/<a\b[^>]*\bhref="([^"]*(?:sign-in|portal)[^"]*)"/g)].map((m) => m[1].replace(/&amp;/g, '&')).filter((h) => /^https?:\/\//.test(h));
  expect(hrefs.length > 0, 'no absolute sign-in/portal link found on the home page');
  const wrong = hrefs.filter((h) => new URL(h).origin !== PORTAL_ORIGIN);
  expect(wrong.length === 0, `links to another address than ${PORTAL_ORIGIN}: ${wrong.slice(0, 3).join(', ')}`);
  return `${hrefs.length} link(s) to ${PORTAL_ORIGIN}`;
});
await check('firm site', 'availability API answers with real call times (database and calendar are connected)', async () => {
  const r = await get(`${MAIN}/api/availability`, { headers: { accept: 'application/json' } });
  expect(r.status === 200, `status ${r.status}: ${r.text.slice(0, 120)}`);
  const body = JSON.parse(r.text);
  const slots = (body.days ?? []).flatMap((d) => d.slots ?? []);
  expect(Array.isArray(body.days) && body.days.length > 0, 'no days in the answer');
  expect(slots.length > 0, 'no free call times at all (are the availability rules seeded?)');
  return `${body.days.length} days, ${slots.length} times`;
});
for (const [path, label] of [['/api/leads', 'create a lead'], ['/api/callbacks', 'ask for a call back'], ['/api/contact', 'send the contact form']]) {
  await check('firm site', `a write from another website is refused (${label})`, async () => {
    const r = await get(`${MAIN}${path}`, { method: 'POST', headers: { origin: 'https://evil.example', 'content-type': 'application/json' }, body: '{}' });
    expect(r.status === 403, `status ${r.status}`);
  });
}
await check('firm site', 'the funnel API is not on the portal, and the portal API is not on the firm site', async () => {
  const a = await get(`${PORTAL}/api/availability`);
  expect(a.status === 404 || a.status === 307 || a.status === 308, `portal /api/availability: ${a.status}`);
  const b = await get(`${MAIN}/api/portal/state`);
  expect(b.status === 404, `firm site /api/portal/state: ${b.status}`);
});

// ---- the portal -----------------------------------------------------------------------------------------------------

await check('portal', 'the bare address is the sign-in page', async () => {
  const r = await get(`${PORTAL}/`);
  expect([307, 308].includes(r.status), `status ${r.status}`);
  expect(location(r, PORTAL)?.pathname === '/sign-in', `redirects to ${r.headers.get('location')}`);
});
await check('portal', 'sign-in page answers 200, is noindex, and has the form', async () => {
  const r = await follow(`${PORTAL}/sign-in`);
  expect(r.status === 200, `status ${r.status}`);
  expect(/noindex/i.test(meta(r.text, 'robots')), 'sign-in is indexable');
  expect(/id="si-email"/.test(r.text) && /id="si-password"/.test(r.text), 'email/password fields missing');
});
for (const path of ['/portal', '/admin', '/admin/team', '/verify', '/two-step']) {
  await check('portal', `${path} without a session goes to sign-in`, async () => {
    const r = await get(`${PORTAL}${path}`);
    expect(r.status === 307, `status ${r.status}`);
    expect(location(r, PORTAL)?.pathname === '/sign-in', `redirects to ${r.headers.get('location')}`);
  });
}
await check('portal', 'portal API without a session is 401', async () => {
  for (const path of ['/api/portal/state', '/api/portal/application', '/api/portal/documents']) {
    const r = await get(`${PORTAL}${path}`, { headers: { accept: 'application/json' } });
    expect([401, 404, 405].includes(r.status), `${path}: status ${r.status}`);
  }
  const r = await get(`${PORTAL}/api/portal/state`, { headers: { accept: 'application/json' } });
  expect(r.status === 401, `/api/portal/state: status ${r.status}`);
});
await check('portal', 'bad emailed links end on the "link expired" page, never in the portal', async () => {
  const r = await get(`${PORTAL}/go/not-a-token`);
  expect(r.status === 303 && location(r, PORTAL)?.pathname === '/link-expired', `status ${r.status} to ${r.headers.get('location')}`);
  const e = await get(`${PORTAL}/enter/not-a-token`);
  expect([303, 307].includes(e.status) && location(e, PORTAL)?.pathname === '/sign-in', `/enter: status ${e.status} to ${e.headers.get('location')}`);
});
await check('portal', 'the dispatcher refuses a call without the secret', async () => {
  for (const method of ['GET', 'POST']) {
    const r = await get(`${PORTAL}/api/cron/dispatch`, { method, headers: { accept: 'application/json' } });
    expect(r.status === 401, `${method} without a token: status ${r.status}`);
    const w = await get(`${PORTAL}/api/cron/dispatch`, { method, headers: { authorization: 'Bearer not-the-secret', accept: 'application/json' } });
    expect(w.status === 401, `${method} with a wrong token: status ${w.status}`);
  }
});
await check('portal', 'a write from another website is refused (sign-in e-mail)', async () => {
  const r = await get(`${PORTAL}/api/auth/forgot`, { method: 'POST', headers: { origin: 'https://evil.example', 'content-type': 'application/json' }, body: '{"email":"nobody@example.com"}' });
  expect(r.status === 403, `status ${r.status}`);
});
await check('portal', 'robots.txt keeps the private areas out; the sitemap is empty', async () => {
  const r = await get(`${PORTAL}/robots.txt`);
  for (const p of ['/admin', '/portal', '/api/', '/sign-in', '/verify', '/two-step']) expect(r.text.includes(`Disallow: ${p}`), `no Disallow: ${p}`);
  const s = await get(`${PORTAL}/sitemap.xml`);
  expect(s.status === 200 && !/<loc>/.test(s.text), 'the portal sitemap lists addresses');
});
await check('portal', 'security headers; the portal may hand a visitor over to the firm site', async () => {
  const r = await get(`${PORTAL}/sign-in`);
  const csp = r.headers.get('content-security-policy') ?? '';
  expect(r.headers.get('x-content-type-options') === 'nosniff', 'no X-Content-Type-Options: nosniff');
  expect(/frame-ancestors/.test(csp) && /object-src 'none'/.test(csp), 'CSP without frame-ancestors / object-src');
  expect(new RegExp(`form-action[^;]*${MAIN_ORIGIN.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(csp), `CSP form-action does not allow ${MAIN_ORIGIN} (emailed links could not hand over)`);
  expect(!r.headers.get('x-powered-by'), 'X-Powered-By is sent');
  if (HTTPS) expect(!!r.headers.get('strict-transport-security'), 'no Strict-Transport-Security on https');
});
await check('portal', 'the old landing addresses lead to the firm site', async () => {
  for (const [from, to] of [['/eligibility', '/apply/eligibility'], ['/privacy', '/apply/privacy'], ['/ger-aus', '/apply']]) {
    const r = await get(`${PORTAL}${from}`);
    const loc = location(r, PORTAL);
    expect([301, 308].includes(r.status) && loc?.origin === MAIN_ORIGIN && loc.pathname === to, `${from}: status ${r.status} to ${r.headers.get('location')}`);
  }
});

// ---- the database behind them (optional) ------------------------------------------------------------------------------

if (SUPABASE && ANON) {
  const rest = (path, init = {}) => get(`${SUPABASE}${path}`, { ...init, headers: { apikey: ANON, authorization: `Bearer ${ANON}`, accept: 'application/json', ...(init.headers ?? {}) } });
  const rows = (r) => {
    try {
      const body = JSON.parse(r.text);
      return Array.isArray(body) ? body.length : -1;
    } catch {
      return -1;
    }
  };
  for (const table of ['leads', 'documents', 'applications', 'bookings', 'staff', 'lead_notes', 'events', 'contact_submissions', 'callback_requests']) {
    await check('database', `a visitor (anon key) reads no rows of ${table}`, async () => {
      const r = await rest(`/rest/v1/${table}?select=*&limit=1`);
      expect(r.status !== 200 || rows(r) === 0, `status ${r.status} with ${rows(r)} row(s)`);
    });
  }
  await check('database', 'a visitor cannot write through the Data API', async () => {
    const r = await rest('/rest/v1/leads', { method: 'POST', headers: { 'content-type': 'application/json', prefer: 'return=minimal' }, body: '{"full_name":"smoke","email":"smoke@example.com"}' });
    expect(r.status === 401 || r.status === 403, `status ${r.status}: ${r.text.slice(0, 100)}`);
  });
  await check('database', 'the staff helpers are closed to visitors', async () => {
    for (const fn of ['is_staff', 'is_admin']) {
      const r = await rest(`/rest/v1/rpc/${fn}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
      expect([401, 403, 404].includes(r.status), `${fn}: status ${r.status}`);
    }
  });
  await check('database', 'the documents bucket is private', async () => {
    const r = await rest('/storage/v1/object/public/documents/smoke-test.txt');
    expect(r.status !== 200, 'the bucket serves public files');
  });
  await check('database', 'sign-ups confirm nothing by themselves and the auth server answers', async () => {
    const r = await rest('/auth/v1/settings');
    expect(r.status === 200, `status ${r.status}`);
    const s = JSON.parse(r.text);
    expect(s.mailer_autoconfirm !== true, 'e-mail sign-ups are auto-confirmed');
    return `google ${s.external?.google ? 'on' : 'off'}, sign-up ${s.disable_signup ? 'closed' : 'open'}`;
  });
} else {
  results.push({ group: 'database', name: 'checks of the Supabase project', ok: true, detail: 'skipped (give --supabase and --anon-key to run them)' });
}

// ---- the rate limit (optional) ----------------------------------------------------------------------------------------

if (flag('rate-limit')) {
  await check('rate limit', 'a visitor cannot dodge the limit by inventing x-real-ip (CLIENT_IP_SOURCE is set for this host)', async () => {
    const codes = [];
    for (let i = 1; i <= 8; i++) {
      const r = await get(`${MAIN}/api/callbacks`, { method: 'POST', headers: { origin: MAIN_ORIGIN, 'content-type': 'application/json', 'x-real-ip': `198.51.100.${i}` }, body: '{}' });
      codes.push(r.status);
    }
    expect(codes.includes(429), `no 429 in ${codes.join(', ')}: the address a visitor sends is trusted (set CLIENT_IP_SOURCE=xff or cloudfront)`);
    return codes.join(' ');
  });
}

// ---- report -----------------------------------------------------------------------------------------------------------

let group = '';
for (const r of results) {
  if (r.group !== group) {
    group = r.group;
    console.log(`\n${group}`);
  }
  console.log(`  ${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? `  (${r.detail})` : ''}`);
}
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length} of ${results.length} checks passed${failed.length ? `, ${failed.length} FAILED` : ''}.`);
console.log('This was a read-only check of what a visitor can see; signing in as an applicant or as staff and the emails are not covered (docs/DEPLOYMENT.md, section "After the first deploy").');
process.exit(failed.length ? 1 : 0);
