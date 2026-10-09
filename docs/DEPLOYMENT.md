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

## 3. Environment variables

Set them in each Vercel project (Settings, Environment Variables, Production + Preview). Generate secrets with `openssl rand -hex 32`.

**Campaign (`dpl-campaign`)**

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_SITE_URL` | `https://euro-passports.com` |
| `NEXT_PUBLIC_MAIN_SITE_URL` | `https://www.lawoffice.org.il` |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<project-ref>.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | publishable key (or legacy anon key) |
| `SUPABASE_SERVICE_ROLE_KEY` | secret key (or legacy service_role key). **Server only.** |
| `APP_SECRET` | 64 hex characters. Signs the lead cookie and emailed links. Changing it logs everybody out of the funnel and invalidates emailed links. |
| `CRON_SECRET` | random; Vercel Cron sends it as `Authorization: Bearer ...` |
| `ZAPIER_EMAIL_WEBHOOK_URL` | Catch Hook URL of the email Zap (section 4) |
| `ZAPIER_CRM_WEBHOOK_URL` | Catch Hook URL of the CRM Zap (or leave empty and set `ZAPIER_WEBHOOK_URL` for one hook) |
| `ZAPIER_SIGNING_SECRET` | optional; adds `x-dpl-signature: sha256=<hmac of the body>` |
| `EMAIL_FROM_NAME` / `EMAIL_FROM_ADDRESS` / `EMAIL_REPLY_TO` | e.g. `Decker Pex Levi` / `cases@euro-passports.com` / `office@lawoffice.org.il` (the From address must be one your email app is allowed to send as) |
| `SEND_EMAIL_HOOK_SECRET` | from Supabase step 5 |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET` | optional |

**Main site (`dpl-main`)**: `NEXT_PUBLIC_SITE_URL=https://www.lawoffice.org.il`, `NEXT_PUBLIC_CAMPAIGN_URL=https://euro-passports.com`, the same three Supabase variables, `APP_SECRET`, the Zapier variables, optional Turnstile keys. (Its contact forms write to the same database through the server.)

## 4. Zapier

The apps never talk to an email provider or a CRM directly. They write every email and every business event to the `events` table (the outbox); a dispatcher posts them as JSON to your Zapier "Catch Hook" URLs, retrying with backoff (2 min, 10 min, 1 h, 6 h, 24 h) and then marking the event `dead`.

**Zap 1: send emails.** Trigger: Webhooks by Zapier, Catch Hook. Filter: `event` equals `email.send`. Action: your email app's "Send Email" (Gmail, Outlook, SendGrid, Mailgun...). Map: To = `data to email`, To name = `data to name`, From name = `data from name`, From = `data from email`, Reply-To = `data replyTo`, Subject = `data subject`, Body (HTML) = `data html`, plain text = `data text`. The body is complete HTML in the lead's language (English or Hebrew, RTL), including the unsubscribe link for nurture emails. Use "HTML" mode, not "plain text".

**Zap 2: CRM and team notifications** (optional, any number of paths). Trigger: Catch Hook. Use "Paths" on `event`:

| `event` | When | Useful for |
|---|---|---|
| `lead.created` | quiz finished and contact details left | create the contact/deal in your CRM, notify the team |
| `lead.returned` | known email re-entered from another browser | nothing (information) |
| `booking.created` / `booking.cancelled` | free call booked / cancelled | calendar entry, assign a lawyer, reminder |
| `callback.requested` | "Speak with an AI Advisor" request | call the person back |
| `contact.created` | website form / lead band / chat | create a lead, notify the team |
| `account.created`, `application.started`, `application.submitted`, `document.uploaded`, `status.changed`, `stage.changed` | portal and CRM progress | update the CRM stage, alerts |
| `unsubscribed` | person unsubscribed from emails | mark the contact in your email tool |

Every CRM event carries `data.lead` (id, caseRef, name, email, phone, locale, route, source, stage, status). Paste a sample by running a test lead through the funnel once, then "Test trigger".

If you use a single hook, set only `ZAPIER_WEBHOOK_URL` and keep the filter step.

## 5. Vercel

For each app: New Project, import the repository, set **Root Directory** to the app folder, Framework Preset Next.js, Node 22. Install Command `pnpm install --frozen-lockfile` (run from the repository root: enable "Include source files outside of the Root Directory"). Add the domains and the environment variables above. The apex `lawoffice.org.il` should redirect to `www` (Vercel Domains).

**Scheduled work.** `/api/cron/dispatch` (campaign) sends the nurture emails that are due and delivers the outbox. `apps/campaign/vercel.json` schedules it every 5 minutes (Vercel Pro; Vercel sends `Authorization: Bearer $CRON_SECRET` itself). **The Hobby plan only allows daily crons and would fail the deploy:** delete the `crons` block from `vercel.json` and run `supabase/snippets/dispatch-cron.sql` in the Supabase SQL editor instead (a `pg_cron` + `pg_net` job, every minute, that calls the same URL with the same bearer token; the secret is kept in Supabase Vault). Until the first dispatch runs, nothing is lost: events wait in the table.

## 6. First staff user

After the first deploy, create your administrator (service role key in the environment):

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co SUPABASE_SERVICE_ROLE_KEY=<secret> \
  pnpm bootstrap:admin you@lawoffice.org.il "Your Name" "<a strong password>"
```

Sign in at `https://euro-passports.com/sign-in`; staff land on `/admin`. Admins can add more staff (role `lawyer` or `case_manager`) and edit the call-availability template and blocked days.

## 7. Google sign-in (optional)

Google Cloud Console, APIs and Services, Credentials, OAuth client ID (Web). Authorised redirect URI: `https://<project-ref>.supabase.co/auth/v1/callback`. Paste the client ID/secret into Supabase Authentication, Providers, Google. Without it the "Continue with Google" button simply fails; hide it by setting the provider off.

## 8. Search engines and AI discovery

- Submit `https://www.lawoffice.org.il/sitemap.xml` and `https://euro-passports.com/sitemap.xml` in Google Search Console and Bing Webmaster Tools (verify both properties).
- `robots.txt` is open to search engines and the AI answer engines (GPTBot, OAI-SearchBot, ClaudeBot, PerplexityBot, Google-Extended, Applebot-Extended...). The main site also serves `/llms.txt` and `/llms-full.txt`. Pages are server-rendered, so crawlers that do not run JavaScript still read the full content.
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
7. Booking hours: the weekly template (Sunday to Thursday, 09:00 to 17:00) is a default; adjust it in `/admin/availability`.

## 10. Operations

- **Stuck emails or CRM events**: `select type, status, attempts, last_error from events where status in ('failed','dead','pending') order by created_at;` A `dead` event exhausted its retries (usually a wrong webhook URL): fix the URL, then `update events set status='pending', attempts=0, next_attempt_at=now() where status='dead';`.
- **Unsubscribes** stop the nurture sequence only; transactional emails (booking confirmation, status updates, password reset) still go out.
- **Data retention**: applications and documents contain sensitive personal data. Decide a retention period with the firm and delete with the staff tools or SQL; deleting a lead cascades to its application, documents rows, bookings and notes (remove the storage objects under `documents/<lead id>/` too).
- **Rotating secrets**: `APP_SECRET` invalidates emailed portal links (people can request a new one by entering their email in the funnel); rotating the service key requires a redeploy.
- **Monitoring**: Vercel logs for route errors (`[api] unhandled error`), Supabase Logs and Advisors (security and performance) after schema changes.

## 11. Local development

```bash
pnpm install
pnpm db:start            # Docker: local Supabase (API 54321, DB 54322, mail inbox http://127.0.0.1:54324)
pnpm db:reset            # applies migrations to the local database
cp apps/campaign/.env.example apps/campaign/.env.local   # fill from `pnpm exec supabase status -o env`
cp apps/main/.env.example apps/main/.env.local
pnpm dev:campaign        # http://localhost:3001  (Hebrew: /he)
pnpm dev:main            # http://localhost:3000
pnpm test                # unit + integration tests (integration needs `pnpm db:start`)
pnpm db:test             # SQL tests (RLS, booking, outbox)
pnpm e2e                 # Playwright end-to-end suite
```
