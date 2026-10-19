# Deployment and operations guide

Two Next.js apps (one repository) on Vercel, one Supabase project, one or two Zapier Zaps. Everything below is configuration:
no code changes are needed to go live. Placeholders you must replace are in `<angle brackets>`.

| | Main site | Campaign |
|---|---|---|
| Directory | `apps/main` | `apps/campaign` |
| Production domain | `www.lawoffice.org.il` (apex redirects to www) | `euro-passports.com` |
| Vercel project | `dpl-main` | `dpl-campaign` |

## 1. Accounts you need

- **Supabase** (database, auth, file storage). Region: `eu-central-1` (Frankfurt) is the closest to Israel.
- **Vercel** (hosting for both apps). Pro plan recommended (cron every 5 minutes, see 5).
- **Zapier** (email sending and CRM sync: you choose the "send email" app and the CRM).
- **Google Cloud** (only for "Continue with Google"): one OAuth client.
- Optional: **Cloudflare Turnstile** (bot protection on the public forms).

## 2. Supabase

1. Create the project (name it `dp-lower`), save the database password, note the **project ref**, **URL**, **publishable (anon) key** and **secret (service role) key** (Project Settings, API).
2. Apply the schema from this repository:
   ```bash
   pnpm exec supabase login
   pnpm exec supabase link --project-ref <project-ref>
   pnpm exec supabase db push        # applies supabase/migrations/*.sql (tables, RLS, storage bucket, realtime, defaults)
   ```
   The migrations create the private `documents` bucket, the RLS policies, the call-booking template (Sunday to Thursday, six slots a day, two calls per slot, Asia/Jerusalem) and the Realtime publication. Nothing else to run.
3. **Authentication, URL configuration** (Authentication, URL Configuration): Site URL `https://euro-passports.com`; Redirect URLs: `https://euro-passports.com/**`, `https://www.lawoffice.org.il/**`.
4. **Authentication, Providers**: Email enabled (leave "Confirm email" as is: the app creates and confirms users itself); minimum password length 8. Google: paste the client ID and secret from step 7.
5. **Authentication, Hooks, Send Email**: HTTPS hook `https://euro-passports.com/api/auth/send-email`, generate the secret and keep it for `SEND_EMAIL_HOOK_SECRET` (format `v1,whsec_...`; `supabase/snippets/auth-send-email-hook.sql` documents the equivalent local setting). With this hook Supabase never sends mail itself: password-reset and sign-in emails are rendered by the app, in the user's language, and delivered through the same Zapier path as every other email, so no SMTP server is needed.
6. **Database, Backups**: enable daily backups (Pro) or schedule `pg_dump`. The `documents` bucket holds passports and civil records: keep it private (it is by default) and restrict who has dashboard access.
7. Realtime: nothing to do (the migration adds the CRM tables to the publication).
8. **Authentication, Multi-Factor (MFA)**: switch on **TOTP** (authenticator app) for both enrolment and verification (hosted: Authentication, Sign In / Providers, Multi-Factor; `[auth.mfa.totp]` in `supabase/config.toml` for the local stack). Staff then protect their account from the **Security** link in the CRM header (`/two-step`); see "Two-step verification" below.

### 2.1 State of the hosted project `Dp-Lower` (set up on 2026-10-09)

Project ref `gfjkvlcecnvrvvqxikhf`, API `https://gfjkvlcecnvrvvqxikhf.supabase.co`, organization "Avihai sabatier" (Pro), region **ap-northeast-1 (Tokyo)**.

Done: all migrations `20261009000001` to `20261009000101` are applied, recorded under their file versions (so `supabase db push` later sees nothing to do); the `documents` bucket is private (20 MB, PDF/JPG/PNG/HEIC/WebP/DOCX); every table has RLS on, the Data API is read-only for signed-in users and closed to visitors, and the SQL tests (`supabase/tests`, all roll back) pass on it; the security advisor lists only two intended items (`rate_limits` has RLS and no policy on purpose: only the server's service role reads it; `is_staff`, `is_admin` and `owns_lead` stay callable by signed-in users because the policies and the sign-in page need them). Auth: Site URL `https://euro-passports.com`; redirect allow-list `https://euro-passports.com/**` and `https://www.lawoffice.org.il/**`; password minimum 8 with the leaked-password check; TOTP multi-factor available for staff (see "Two-step verification"); the case reference counter starts at DPL-26-1001.

Still to do by hand (they need things only the firm has): step 5 above (Send Email hook, once the campaign is deployed and `SEND_EMAIL_HOOK_SECRET` exists), Google (section 7), backups, and the Vercel variables (section 3: the URL and the publishable key are public, the **service role key** is a secret: Project Settings, API Keys, `service_role`).

Region: Tokyo is about 200 ms from Israel for every database round trip, Frankfurt about 60 ms. The project is empty, so moving to `eu-central-1` costs nothing now: create a new project there and apply the migrations (`supabase db push`).

## 3. Environment variables

Set them in each Vercel project (Settings, Environment Variables, Production + Preview). Generate secrets with `openssl rand -hex 32`.

**Language of the campaign pages** (both projects, same value): `NEXT_PUBLIC_CAMPAIGN_LOCALES` is `en` (or unset) for English only, the current decision; `en,he` publishes the Hebrew edition too. It is read at build time, so changing it needs a new deploy.

**Campaign (`dpl-campaign`)**

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_SITE_URL` | `https://euro-passports.com` |
| `NEXT_PUBLIC_MAIN_SITE_URL` | `https://www.lawoffice.org.il` |
| `NEXT_PUBLIC_CAMPAIGN_URL` | optional: the origin used in emailed links and email images. Defaults to `NEXT_PUBLIC_SITE_URL`, which is right for production; set it only if the campaign is served from a different address than the one it is built for. |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<project-ref>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | publishable key (or legacy anon key) |
| `SUPABASE_SERVICE_ROLE_KEY` | secret key (or legacy service_role key). **Server only.** |
| `APP_SECRET` | 64 hex characters. Signs the lead cookie and emailed links. Changing it logs everybody out of the funnel and invalidates emailed links. |
| `CRON_SECRET` | random; Vercel Cron sends it as `Authorization: Bearer ...` |
| `STAFF_MFA_REQUIRED` | optional, `1` to make two-step verification compulsory for every staff member (they must enrol before the CRM opens). Leave it unset until every member has had a chance to enrol, then switch it on. |
| `ZAPIER_EMAIL_WEBHOOK_URL` | Catch Hook URL of the email Zap (section 4) |
| `ZAPIER_CRM_WEBHOOK_URL` | Catch Hook URL of the CRM Zap (or leave empty and set `ZAPIER_WEBHOOK_URL` for one hook) |
| `ZAPIER_SIGNING_SECRET` | optional; adds `x-dpl-signature: sha256=<hmac of the body>` |
| `EMAIL_FROM_NAME` / `EMAIL_FROM_ADDRESS` / `EMAIL_REPLY_TO` | e.g. `Decker Pex Levi` / `cases@euro-passports.com` / `office@lawoffice.org.il` (the From address must be one your email app is allowed to send as) |
| `SEND_EMAIL_HOOK_SECRET` | from Supabase step 5 |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET` | optional |

**Main site (`dpl-main`)**: it hosts the firm's website AND the landing pages and eligibility funnel (`/apply`), so it needs: `NEXT_PUBLIC_SITE_URL=https://www.lawoffice.org.il`, `NEXT_PUBLIC_CAMPAIGN_URL` (the address of the **campaign/portal app**; the build stops if it is missing), `NEXT_PUBLIC_CAMPAIGN_LOCALES`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and **the same `APP_SECRET` as the campaign** (it signs the lead cookie, the unsubscribe links and the 2-minute token that carries "Go to my portal" to the other site; with different values every hand-over fails), optional `EMAIL_FROM_*`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET`, `CLIENT_IP_SOURCE`. The main site queues mail and events in the outbox; the campaign's dispatcher delivers them, so the Zapier URLs and `CRON_SECRET` belong in the campaign project only.

## 4. Zapier

The apps never talk to an email provider or a CRM directly. They write every email and every business event to the `events` table (the outbox); a dispatcher posts them as JSON to your Zapier "Catch Hook" URLs, retrying with backoff (2 min, 10 min, 1 h, 6 h, 24 h) and then marking the event `dead`.

**Zap 1: send emails.** Trigger: Webhooks by Zapier, Catch Hook. Filter: `event` equals `email.send`. Action: your email app's "Send Email" (Gmail, Outlook, SendGrid, Mailgun...). Map: To = `data to email`, To name = `data to name`, From name = `data from name`, From = `data from email`, Reply-To = `data replyTo`, Subject = `data subject`, Body (HTML) = `data html`, plain text = `data text`. For `data category` = `nurture`, `data listUnsubscribe` is the signed one-click unsubscribe address: if your email app can set headers (SendGrid, Mailgun, Postmark and Amazon SES can; Gmail and Outlook actions cannot), send `List-Unsubscribe: <that url>` and `List-Unsubscribe-Post: List-Unsubscribe=One-Click`, which keeps the nurture sequence out of spam folders and satisfies the Gmail/Yahoo bulk-sender rules. The body is complete HTML in the lead's language (English or Hebrew, RTL), including the unsubscribe link for nurture emails. Use "HTML" mode, not "plain text".

**Zap 2: CRM and team notifications** (optional, any number of paths). Trigger: Catch Hook. Use "Paths" on `event`:

| `event` | When | Useful for |
|---|---|---|
| `lead.created` | quiz finished and contact details left | create the contact/deal in your CRM, notify the team |
| `lead.returned` | known email re-entered from another browser | nothing (information) |
| `booking.created` / `booking.cancelled` | free call booked / cancelled (`data.reason`: `cancelled` by the applicant, `rescheduled`, `staff`) | calendar entry for the lawyer in `data.booking.lawyer` (id, name, email; null when the call is not assigned), reminder |
| `booking.no_show` | the team marked that the applicant did not take the call | follow up (no email goes to the applicant) |
| `booking.held` | the team corrected a no-show to "call held" | undo the follow-up |
| `callback.requested` | "Speak with an AI Advisor" request | call the person back |
| `contact.created` | website form / lead band / chat | create a lead, notify the team; carries the form's `source` and `utm` |
| `lead.updated` | name, phone, email or answers changed (by the applicant or by staff) | keep the contact in your CRM current; `data.changed` names the fields, `data.previous.email` the old address after a correction |
| `account.created`, `application.started`, `application.submitted`, `document.uploaded`, `document.removed`, `status.changed`, `stage.changed` | portal and CRM progress | update the CRM stage, alerts |
| `unsubscribed` | person unsubscribed from emails | mark the contact in your email tool |
| `lead.deleted` | an administrator deleted an applicant (right to erasure) | delete the contact in your own tools too; the event carries no personal data, only the case reference |

Every CRM event carries `data.lead` (id, caseRef, name, email, phone, locale, route, source, stage, status), except `contact.created` (`data.submission`), `callback.requested` (`data.callback`) and `lead.deleted` (`data.caseRef`, `by`, `deletedAt`). Other events the outbox can carry, if you want them in your CRM: `document.reviewed` (staff approved or rejected a file) and `result.requested` (the applicant asked for their result by email). Paste a sample by running a test lead through the funnel once, then "Test trigger".

If you use a single hook, set only `ZAPIER_WEBHOOK_URL` and keep the filter step.

## 4b. AWS Amplify (if the sites are hosted there instead of Vercel)

`amplify.yml` at the root builds both sites. Create two Amplify apps from this repository (platform Web Compute), set `AMPLIFY_MONOREPO_APP_ROOT` to `apps/main` on one and `apps/campaign` on the other, and give each the variables of section 3. The **campaign needs its own address** (an Amplify domain or a custom one, e.g. `app.euro-passports.com`), and the **main site's `NEXT_PUBLIC_CAMPAIGN_URL` must be that address**: the "Client portal" and "Check eligibility" buttons are built from it when the main site is built, and without it they point at the old euro-passports.com site (the main build now stops if it is missing). Also set on the campaign `NEXT_PUBLIC_SITE_URL` (its own address) and `NEXT_PUBLIC_MAIN_SITE_URL` (the firm's site), and in Supabase (Authentication, URL Configuration) the campaign's address as Site URL and in the redirect list. After changing a `NEXT_PUBLIC_*` value, redeploy. **Rate limits and the visitor's address:** off Vercel a visitor can send `x-real-ip` themselves, so on Amplify set `CLIENT_IP_SOURCE=xff` in both apps (the rate limit then reads only the `x-forwarded-for` entry the last trusted proxy added; `TRUSTED_PROXY_HOPS`, default 1, is how many proxies sit in front of the app; with CloudFront alone it is 1). Alternatively `CLIENT_IP_SOURCE=cloudfront` reads `CloudFront-Viewer-Address`, which needs CloudFront to forward that header. Check once after the first deploy: call `POST /api/callbacks` seven times in a minute from one machine with a different `x-real-ip` each time; the sixth and seventh must answer 429. Amplify does not send the visitor's country by default, so the Hebrew start for visitors in Israel (ARCHITECTURE section 5) needs `CloudFront-Viewer-Country` forwarded; without it everyone starts in English, which is safe. The cron call (section 5) must be scheduled outside Amplify: Supabase pg_cron, see `supabase/snippets/dispatch-cron.sql`.

## 5. Vercel

For each app: New Project, import the repository, set **Root Directory** to the app folder, Framework Preset Next.js, Node 22. Install Command `pnpm install --frozen-lockfile` (run from the repository root: enable "Include source files outside of the Root Directory"). Add the domains and the environment variables above. The apex `lawoffice.org.il` should redirect to `www` (Vercel Domains).

**Scheduled work.** `/api/cron/dispatch` (campaign) sends the nurture emails that are due and delivers the outbox. `apps/campaign/vercel.json` schedules it every 5 minutes (Vercel Pro; Vercel sends `Authorization: Bearer $CRON_SECRET` itself). **The Hobby plan only allows daily crons and would fail the deploy:** delete the `crons` block from `vercel.json` and run `supabase/snippets/dispatch-cron.sql` in the Supabase SQL editor instead (a `pg_cron` + `pg_net` job, every minute, that calls the same URL with the same bearer token; the secret is kept in Supabase Vault). Until the first dispatch runs, nothing is lost: events wait in the table.

### After the first deploy: the smoke test

`pnpm smoke:live` checks the DEPLOYED system the way a visitor sees it, and only reads (it creates no lead, booking or account):

```bash
pnpm smoke:live --main https://www.lawoffice.org.il --portal https://euro-passports.com \
  --supabase https://<project-ref>.supabase.co --anon-key <publishable key> --rate-limit
```

It covers: every public page of the firm's site and the landing pages answer; the "Client portal" and sign-in links go to the portal app (not to the old address); the call times come out of the real database; the portal's private pages send a visitor to sign-in; bad emailed links end on "link expired"; the dispatcher refuses a call without the secret; writes from another website are refused; the security headers and the CSP hand-over rule; robots and sitemaps; with `--supabase`/`--anon-key`, that a visitor reads no rows of any table, writes nothing, cannot call the staff helpers, finds the `documents` bucket private and that e-mail sign-ups are not auto-confirmed; with `--rate-limit`, that a visitor cannot choose their own rate-limit address (this is the `CLIENT_IP_SOURCE` check above). It also runs against `localhost` (against the local stack the sign-up check fails by design, because the local config auto-confirms). Exit code 1 when any check fails. What it cannot do for you: sign in as an applicant or as staff, receive an email, use Google, and run the scheduled dispatch; do those by hand once: create a test lead from `/apply`, check the email arrives, sign in at the portal, open `/admin`, enrol the authenticator app (below).

## 6. First staff user

After the first deploy, create your administrator (service role key in the environment):

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co SUPABASE_SERVICE_ROLE_KEY=<secret> \
  pnpm bootstrap:admin you@lawoffice.org.il "Your Name" "<a strong password>"
```

Without the password argument the tool generates one and prints it once. The sign-up endpoint is public, so an address that somebody registered before it became staff gets a new password (and its sessions are ended) rather than keeping the one its registrant chose; an account that is already staff keeps its password when the tool is run again.

Sign in at `https://euro-passports.com/sign-in`; staff land on `/admin`. Admins can add more staff (role `lawyer` or `case_manager`) and edit the call-availability calendars (the unassigned template, each lawyer's hours) and blocked days; a lawyer edits their own hours and days off.

### Two-step verification (staff)

A staff member can protect their account with an authenticator app (Google Authenticator, Microsoft Authenticator, 1Password and others): **Security** in the CRM header, then *Set up an authenticator app*, scan the QR code and type the first code. From then on the sign-in asks for the 6-digit code after the password (`/verify`), and **nothing opens without it**: the CRM pages and actions answer to `requireStaff()`, and the database applies the same rule to its own staff checks (`is_staff()` / `is_admin()`, migration `20261019000001_staff_mfa.sql`: a session that is still at assurance level aal1 is not staff to the Data API, so a stolen password alone cannot read the leads or the documents there either). Turning it off needs the code too.

Enrolment is optional until you set `STAFF_MFA_REQUIRED=1`. The sensible order: switch TOTP on in Supabase (step 8 above), deploy, have the administrator enrol first (do it from `/two-step` and keep the secret key or the phone safe), then the others, then set `STAFF_MFA_REQUIRED=1` and redeploy. **Recovery:** there are no backup codes. If a member loses the phone, an administrator removes the factor in Supabase (Authentication, Users, the member, *Remove MFA factors*) and the member enrols again; if the only administrator loses it, do the same in the dashboard as the project owner. Applicants never see any of this.

## 7. Google sign-in (optional)

Google Cloud Console, APIs and Services, Credentials, OAuth client ID (Web). Authorised redirect URI: `https://<project-ref>.supabase.co/auth/v1/callback`. Paste the client ID/secret into Supabase Authentication, Providers, Google. Without it the "Continue with Google" button simply fails; hide it by setting the provider off.

## 8. Search engines and AI discovery

- Language default: Vercel adds the visitor's country (`x-vercel-ip-country`) to every request, nothing to configure; a visitor in Israel opening an English address is redirected to `/he` (see ARCHITECTURE section 5). Search-engine crawlers are exempt, so the English and Hebrew editions are indexed as before.

- Submit `https://www.lawoffice.org.il/sitemap.xml` and `https://euro-passports.com/sitemap.xml` in Google Search Console and Bing Webmaster Tools (verify both properties).
- `robots.txt` is open to search engines and the AI answer engines (GPTBot, OAI-SearchBot, ClaudeBot, PerplexityBot, Google-Extended, Applebot-Extended...). Both sites serve `/llms.txt` and `/llms-full.txt`. Pages are server-rendered, so crawlers that do not run JavaScript still read the full content.
- Create a Google Business Profile for both offices with the same name, address and phone as in the structured data.
- Old `?p=...` and `?lang=he` URLs of the prototype are redirected (301) to the clean addresses.

## 9. Before the public launch (content that only the firm can approve)

The design deliberately contains placeholders, each visibly marked in the pages:

1. Legal texts (privacy, terms, accessibility statement): "Draft for review". Replace with the approved wording (edit `apps/main/messages/{en,he}/legal.json` and `apps/campaign/messages/{en,he}/landingMore.json`).
2. Marketing claims flagged "To verify" / "to be confirmed": the 30% fee reduction, the figures (1,200+ families, 15+ years, 94% approval, 30+ countries), 4.9 / 380+ Google reviews, the "case in full" story, the fee model, press items.
3. The eligibility criteria: `evaluateEligibility()` in `packages/core/src/quiz.ts` currently only reads the route and the closest relative; the firm's legal criteria go there.
4. Hebrew copy: all Hebrew text was written by an AI translator and must be read by a Hebrew-speaking lawyer or editor before launch (it lives in the same `messages/he/*.json` files and `packages/emails`).
5. The "Speak with an AI Advisor" button records a callback request for the team; no voice AI is connected. The wording says so.
6. Confirm the Instagram link in the footers (`sabatier_group_ai_marketing`) and the domains used in canonical URLs.
7. Booking hours: the weekly template (Sunday to Thursday, 09:00 to 17:00, two calls per slot, not tied to a lawyer) is a default; adjust it in `/admin/availability`. Once each lawyer (Team, role `lawyer`) has set their own hours there, calls are assigned to them; remove the unassigned template's times when it is no longer wanted. The booking step says "N free calls left this week" with the real number of free seats from now to the end of the firm's week (Sunday to Saturday), and says nothing once the week has none; a wide calendar therefore shows a large number, and the number is lowered by setting fewer seats, not by the page.

## 10. Operations

- **Stuck emails or CRM events**: `select type, status, attempts, last_error from events where status in ('failed','dead','pending') order by created_at;` A `dead` event exhausted its retries (usually a wrong webhook URL): fix the URL, then `update events set status='pending', attempts=0, next_attempt_at=now() where status='dead';`.
- **Unsubscribes** stop the nurture sequence only; transactional emails (booking confirmation, status updates, password reset) still go out.
- **Event states**: `pending`, `processing`, `sent`, `failed` (will be retried), `dead` (retries used up) and `cancelled` (deliberately never sent: a queued nurture email for someone who unsubscribed, submitted, corrected their address or was deleted; nurture emails older than 48 hours are cancelled instead of arriving late).
- **Data retention and erasure**: applications and documents contain sensitive personal data. An administrator can delete an applicant from the lead card (**Delete applicant**, type the case reference to confirm): it removes the stored files, the sign-in user, the application, bookings, notes, events and enquiries of that address, writes a line without personal data to `deletion_log` and emits `lead.deleted`. Decide a retention period with the firm; there is no automatic purge. Staff cannot be deleted this way.
- **Client address and rate limits**: the per-address limits on the public routes use the address of the visitor as Vercel reports it (`x-vercel-forwarded-for`, then `x-real-ip`, then the right-most `x-forwarded-for` entry, which is the one the platform appends). Behind any other proxy, make sure it overwrites those headers; the left-most `x-forwarded-for` entry is whatever the visitor sent and is never trusted. A database error makes the limiter fail open (the form keeps working).
- **Content-Security-Policy**: `script-src` allows `'unsafe-inline'` because the pages are static (a per-request nonce would make every page dynamic), and Next.js, the accessibility bootstrap and the structured data use inline scripts. Everything else is closed (`default-src 'self'`, no `eval`, frames only for YouTube and Turnstile). This is an accepted residual risk: no place in the code renders visitor-supplied HTML. If the firm wants a strict policy later, the move is nonce-based CSP with `'strict-dynamic'`.
- **Rotating secrets**: `APP_SECRET` invalidates emailed portal links (people can request a new one by entering their email in the funnel); rotating the service key requires a redeploy.
- **Monitoring**: Vercel logs for route errors (`[api] unhandled error`), Supabase Logs and Advisors (security and performance) after schema changes.

## 11. Local development

```bash
pnpm install
pnpm db:start            # Docker: local Supabase (API 54321, DB 54322, mail inbox http://127.0.0.1:54324)
pnpm db:reset            # applies migrations to the local database
cp apps/campaign/.env.example apps/campaign/.env.local   # fill from `pnpm exec supabase status -o env`
cp apps/main/.env.example apps/main/.env.local
# in both files point the three URLs at the local servers (the examples hold the production domains, which make the
# production build upgrade requests to https and write production canonicals and cookies):
#   NEXT_PUBLIC_SITE_URL=http://localhost:3000  NEXT_PUBLIC_MAIN_SITE_URL=http://localhost:3000  NEXT_PUBLIC_CAMPAIGN_URL=http://localhost:3001
# (main: NEXT_PUBLIC_SITE_URL=http://localhost:3000, NEXT_PUBLIC_CAMPAIGN_URL=http://localhost:3001)
pnpm dev:campaign        # http://localhost:3001  (Hebrew: /he)
pnpm dev:main            # http://localhost:3000
pnpm test                # unit + integration tests (the database ones run when the Supabase variables are set, otherwise they are skipped)
pnpm db:test             # SQL tests (RLS, booking, outbox)
pnpm e2e                 # Playwright end-to-end suite
```
