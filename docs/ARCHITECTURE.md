# Architecture and contracts

This is the single source of truth for how the system is put together. Everyone who adds code reads it first.

## 1. What is being built

Two Next.js 15 apps (App Router, TypeScript, React 19) in a pnpm monorepo, both English (LTR) and Hebrew (RTL):

| App | Domain (production) | Port | What it is |
|---|---|---|---|
| `apps/main` (`@dpl/main`) | www.lawoffice.org.il | 3000 | The law firm's website: home, about, 22 services, 37 team members, 8 articles, testimonials, media, contact, legal pages |
| `apps/campaign` (`@dpl/campaign`) | euro-passports.com | 3001 | German/Austrian citizenship campaign: landing page, eligibility quiz, lead capture, free-call booking, personalised offer, client portal (application + documents), firm CRM at `/admin` |

Backend: Supabase (Postgres + RLS, Auth, Storage, Realtime). Email and CRM sync go through a transactional outbox
(`events` table) that a dispatcher delivers to Zapier webhooks. There is no other backend service.

The design is final and supplied as HTML prototypes. **Do not redesign. Recreate pixel for pixel and make it work.**

## 2. Repository layout

```
apps/campaign, apps/main     Next.js apps. src/app/[locale]/..., messages/{en,he}/*.json, public/
packages/core                @dpl/core    pure TS: domain constants, zod schemas, slots, drip rules, signed tokens (no I/O)
packages/db                  @dpl/db      Supabase clients, outbox, lead/auth session plumbing, http helpers (server only unless noted)
packages/ui                  @dpl/ui      s()/x() style helpers (RTL aware), base.css, hover.css, fonts.css, RevealObserver, hooks
packages/i18n                @dpl/i18n    typed firm content (services, team, articles, testimonials, offices) en/he + URL helpers
packages/emails              @dpl/emails  email templates (renderEmail) en/he
supabase/                    config.toml, migrations/, tests/ (SQL tests: bash supabase/tests/run.sh)
docs/                        this file, DEPLOYMENT.md
e2e/                         Playwright end-to-end tests
```

Import server-only modules by file: `@dpl/db/admin`, `@dpl/db/server`, `@dpl/db/outbox`, `@dpl/db/http`, `@dpl/db/lead-session`,
`@dpl/db/portal-session`, `@dpl/db/links`, `@dpl/db/rate-limit`, `@dpl/db/dispatch`; client: `@dpl/db/browser`; types: `@dpl/db/types`.
Add new server modules for the apps in `apps/<app>/src/server/*.ts` (start the file with `import 'server-only'`).

## 3. Commands

```
pnpm install --frozen-lockfile          # in a fresh worktree, first thing
pnpm exec vitest run [path]             # unit tests (root config picks up packages/*/src and apps/*/src)
pnpm --filter @dpl/campaign exec tsc --noEmit      # typecheck one app
pnpm --filter @dpl/campaign exec eslint src        # lint one app
bash supabase/tests/run.sh              # SQL tests against the local database
```

Local Supabase is already running (Docker): API http://127.0.0.1:54321, DB postgresql://postgres:postgres@127.0.0.1:54322/postgres,
mail inbox (Mailpit) http://127.0.0.1:54324. It is shared by everybody: create your own test leads (unique emails like
`you+1700000000@example.com`), never reset or truncate the database, never change migrations without telling the coordinator.
`.env.local` files are git-ignored; in a fresh worktree copy them: `cp /home/user/Dp-Lower/apps/campaign/.env.local apps/campaign/.env.local` (same for main).

Running a dev server in your worktree: `pnpm --filter @dpl/campaign exec next dev -p <your port>` (use the port in your brief; never
touch ports 3000/3001, they belong to the coordinator). Do not run `next build` unless you need to (CPU is shared).

## 4. Rules for porting the design (all workers)

The prototypes live (read-only) in `/tmp/claude-0/-home-user-Dp-Lower/da03b263-f960-5b12-8d27-94b18ce889b9/scratchpad/design/form-design-blockers/project/`.
They are `.dc.html` files: an HTML template (`<x-dc>`) with `{{ binding }}`, `<sc-if value=>`, `<sc-for list= as=>`, `style-hover=` /
`style-focus=` attributes, plus one `class Component` in `<script type="text/x-dc">` whose `renderVals()` feeds the bindings. They are
prototypes, not production code: port the *look and behaviour*, not the structure. **Read your whole range, top to bottom, including the
logic that feeds it, before writing.** Line ranges are in your brief.

1. **Fidelity.** Every size, colour, spacing, font size/weight, radius, border, shadow, animation timing and breakpoint is copied verbatim. When the prototype computes a style string in `renderVals` (e.g. `headerCss`), port the same conditions.
2. **Styling with `s()` / `x()` from `@dpl/ui`.** Paste the prototype's inline style string: `<div style={s("display:flex;gap:12px;padding:18px clamp(20px,4.6vw,160px)")}>`. `s()` converts `margin-left`, `padding-right`, `text-align:left`, `left`, `border-left`, 4-value `margin/padding/border-radius` and gradient directions into direction-aware logical equivalents, maps `font-family:'Newsreader'`/`'Manrope'` to the Hebrew-aware `var(--font-serif)`/`var(--font-sans)`, so one declaration is right in English and Hebrew. Hover/focus: `<a {...x("color:#000;...", { hover: "color:#a07a3c", focus: "outline:2px solid #a07a3c" })}>` (the prototype's `style-hover` / `style-focus`; supported properties are in `packages/ui/src/style.ts` `STATE_PROPS`; add one there and in `hover.css` if you need another). For `x()` with extra classes use `className`. `!important` is not allowed in inline styles: put the rule in a CSS file.
   - For a purely physical thing that must not flip (a centred element using `left:50%` + `translateX(-50%)`), add a CSS comment reading noflip to that style string (see the doc comment at the top of `style.ts`).
   - Transforms/animations that move horizontally: use `calc(Npx * var(--dir, 1))` (`--dir` is 1 in LTR, -1 in RTL, set on `<html>`).
   - Arrows/chevrons that mean "forward": flip in RTL with `transform: scaleX(var(--dir, 1))` or pick the mirrored glyph.
   - Responsive rules use the `data-*` attributes from `globals.css` (`data-resp`, `data-pad`, `data-h1`, ...). Keep those attributes on the same elements as the prototype. React serialises styles as `height:1px` (no space), so prototype selectors like `[style*="height: 1px"]` do not work: use a data attribute (see the notes at the top of each `globals.css`).
   - Put component CSS that needs real selectors (pseudo-elements, media queries) in a **new file you own** (e.g. `apps/campaign/src/styles/landing.css`) and import it from your component. Do not edit `globals.css`, `@dpl/ui` or `packages/db` unless your brief says so; if you need a change there, make it minimal and mention it in your report.
3. **Images** come from `apps/<app>/public/images/*` (already copied). Photos: `next/image` with explicit width/height or `fill` + `sizes` (keep the prototype's displayed size and `object-fit`). Hero/LCP image: `priority`. Logos/small decorative images may be plain `<img>`. Flags and icons that the prototype draws in CSS/SVG stay CSS/SVG.
4. **Server vs client.** Default to Server Components. Mark a file `'use client'` only for state/effects/handlers. Pass data and translated strings as props from server parents when convenient. Interactive pieces: keep them small leaf components.
5. **Accessibility.** Keep or improve semantics: real `<button>`/`<a>`, labels tied to inputs, `aria-*` for accordions/dialogs/tabs, visible focus, `alt` text (translated), `lang` handled by the layout. Dialogs trap focus and close on Escape.
6. **No hard-coded user-facing strings** (see section 5). **No new dependencies**: if you truly need one, say so in your report instead of installing it (shared `pnpm-lock.yaml`).
7. **TypeScript strict, no `any`, no `// @ts-ignore`.** Keep files focused (split big components). Match the surrounding code's style; comments only where the code is not self-explanatory.
8. **Quality gate before you finish:** `tsc --noEmit` and `eslint src` clean for your app; the `messages.test.ts` parity test passes (`pnpm exec vitest run apps/<app>`); your own tests pass; you have looked at your pages in a real browser (Playwright is installed: use `chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' })`, or check `ls /opt/pw-browsers`) at 1440px and 390px wide, in English and `/he`, and compared them with the prototype rendering rules in the source (no console errors, no horizontal scroll, RTL layout mirrored correctly).

## 5. Internationalisation

- next-intl 4. English at `/…`, Hebrew at `/he/…` (`localePrefix: 'as-needed'`, no auto-detection). `<html lang dir>` is set by the layout. Use `Link`, `redirect`, `usePathname`, `useRouter` from `@/i18n/navigation` (never `next/link` for internal links) so the locale prefix is kept.
- Messages: `apps/<app>/messages/{en,he}/<namespace>.json`. **You own the namespaces assigned to you** and only edit those files. Never rename or add a namespace (the list is in `src/i18n/messages.ts`; ask the coordinator).
- `messages.test.ts` fails if English and Hebrew key sets differ or any value is empty. Arrays/objects are fine (`t.raw('key')` returns them; keep arrays the same length in both languages). Inline emphasis/links: `t.rich('key', { b: (c) => <strong>{c}</strong> })`; plurals/numbers: ICU (`{count, plural, one {…} other {…}}`).
- Server Components: `getTranslations('ns')`; Client Components: `useTranslations('ns')`, and the page/group layout must wrap them in `<ClientMessages namespaces={['ns', …]}>` (`src/components/ClientMessages.tsx`) so the browser receives those namespaces (the root layout only sends `common`/`site`). Keep client namespaces small.
- **English** copy is copied verbatim from the prototype (keep its punctuation, `·`, `→`, curly quotes). **Hebrew** is a professional translation by you: natural, idiomatic modern Hebrew in the register of an Israeli law firm's website (formal but warm, not literal); address the reader in second person plural-neutral or masculine-default phrasing consistently with the firm's existing Hebrew content in `packages/i18n/src/content/he.ts` (read it first and reuse its terminology: אזרחות מכוח מוצא, משרד הפנים, רשות האוכלוסין וההגירה, etc.). Legal terms must be accurate; names of people, places, products and laws stay as in the English (transliterate only if the Hebrew content does). Keep numerals Western; dates/times via `Intl`/next-intl formatters with the right locale; currency symbols as in the source. Do not translate: URLs, emails, phone numbers, case references (DPL-26-1001), `Decker Pex Levi` (Hebrew: דקר פקס לוי is used on lawoffice.org.il; use the Hebrew content file's spelling of the firm name).
- Placeholder marketing claims in the prototype (30% discount, 94% approval, 4.9 · 380+ reviews, 'To verify' badges, 'Illustrative case…', 'to be confirmed by the firm') are kept exactly as designed, including their disclaimers. Do not invent new claims.
- RTL: icons/arrows that imply direction are mirrored; numbers, Latin names, emails and phone numbers inside Hebrew text are wrapped in `<bdi>` or `dir="ltr"` spans where they would otherwise reorder punctuation; inputs for email/phone/URL use `dir="ltr"` (and `inputMode`), names/free text follow the page direction.

## 6. Data model (see `supabase/migrations/*.sql` and `packages/db/src/database.types.ts`)

`leads` (one row per person; unique lowercase email; `case_ref` DPL-YY-NNNN; `route`, `answers` jsonb with the keys of `QUIZ`, `stage` pipeline column, `status` applicant-facing, `owner_id`, timestamps for each milestone, `session_epoch`), `bookings`, `availability_rules` / `availability_exceptions` (firm time zone Asia/Jerusalem, Sunday–Thursday, 6 slots a day, capacity 2), `applications` (`data` jsonb keyed by the field ids in `APPLICATION_SECTIONS`), `documents` (one row per lead and `DOC_TYPES` slot), `lead_notes`, `activity_log` (`kind` system|staff, `code`, English `text`, `meta`; the CRM localises by `code`), `callback_requests`, `contact_submissions`, `events` (outbox), `email_sequence_state`, `staff`, `app_settings`, `rate_limits`. View `admin_lead_rows`. Storage bucket `documents` (private; path `{lead_id}/{doc_type}/{uuid}-{name}`, see `documentPath()`).

RLS: applicants can only READ their own rows; staff read/manage everything; **all writes from visitors go through server routes with the service-role client** after identifying the caller with `resolveLead()`. Never accept a lead id from the client; derive it from the lead cookie or Supabase session. Domain rules (`advanceStage`, `nextAction`, `planDrip`, `computeAvailability`, schemas…) live in `@dpl/core`; add logic there, with tests, not in components.

## 7. Authentication model (security critical, read before touching auth)

Implemented in `packages/db/src/lead-session.ts`, `portal-session.ts`, `links.ts`:

1. `POST /api/leads` creates a lead and sets the signed **lead cookie** `dpl_lead` (httpOnly, 30 days, carries `session_epoch`). It proves "this browser created the lead", nothing more. It authorises: booking, callback, reading the lead summary, `POST /api/portal/enter`.
2. `POST /api/portal/enter` → `openPortalSession()`: creates the Supabase user for the lead and signs the browser in without a password ("No password needed. It is already yours."). Sets `account_created_at`, advances the stage to `account`, emits `account.created`.
3. **A lead that already exists for an email can only be entered through an emailed link**: `POST /api/leads` with a known email and no matching cookie changes nothing, sends the `file-open` email (with a portal link) and returns `{ status: 'existing' }`; the UI says "we've emailed you a link". This stops anyone from taking over or overwriting someone else's lead.
4. Emailed links are `/go/[token]` (signed, 60 days, bound to `session_epoch`): the route verifies the token, runs `markEmailVerified()` and `openPortalSession()`, then redirects to `next` (validated with `safeNext`). `markEmailVerified` from a different browser than the lead's creator revokes the password/sessions and bumps the epoch (pre-registration defence).
5. Passwords are set in the portal (`Set password` screen, email prefilled and locked): `POST /api/auth/set-password` (needs a Supabase session). Sign-in: email + password, or Google (`signInWithOAuth`) via `/auth/callback`, which runs `ensureLeadForUser` + `markEmailVerified`. Forgot password: `POST /api/auth/forgot` (always answers 200, rate limited) → recovery link by email → `/auth/callback?…` → `/create-password?mode=reset`.
6. Staff are Supabase users with a row in `staff`. `/portal/**` requires a session (middleware); `/admin/**` requires a session **and** `staff` membership (checked in the admin layout and again in every server action/route with `requireStaff()`).
7. Every state-changing route: `assertSameOrigin(req)`, rate limit (`limitOrThrow`), zod validation (`parseJson`), error codes via `ApiError`, wrapped in `handle()`. Honeypot field `website` on public forms; Turnstile (`verifyTurnstile`) when configured.

## 8. API contract (campaign app, `apps/campaign/src/app/api/**/route.ts`)

All JSON. Errors: `{ error: '<code>', details? }` with the right status (400 invalid_body, 401 unauthorized, 403 forbidden/bad_origin, 404 not_found, 409 conflict codes, 429 rate_limited). Success payloads below. Schemas are in `@dpl/core` (`schemas.ts`).

| Route | Auth | Body → Response |
|---|---|---|
| `POST /api/leads` | none (rate limit 10/min/IP) | `LeadInput` → `201 {status:'created', leadId, caseRef}` · `200 {status:'updated', …}` (same cookie) · `200 {status:'existing'}` (email known, other browser; emails a link) |
| `GET /api/lead` | cookie or session | → `{leadId, caseRef, fullName, firstName, email, phone, locale, route, answers, stage, status, accountCreated, passwordSet, emailVerified, booking: {id,startsAt,endsAt,timezone}|null}` · 401 |
| `PUT /api/lead/answers` | cookie or session | `{answers}` (merge) → `{ok:true}` |
| `GET /api/availability` | none | → `{days: SlotDay[], seatsLeft, timezone, callMinutes}` (from `computeAvailability`, 5 bookable days) |
| `POST /api/bookings` | cookie or session | `BookingInput` → `201 {booking}`; 409 `slot_unavailable` (also for slot_full/slot_too_soon); emits `booking.created`, queues `booking-confirmation`, logs activity |
| `DELETE /api/bookings` | cookie or session | → `{ok:true}`; emits `booking.cancelled` |
| `POST /api/callbacks` | none (rate limit 5/min/IP); links the lead if a cookie is present | `CallbackInput` → `201 {ok:true}`; row in `callback_requests`; emits `callback.requested` |
| `POST /api/results/email` | cookie | → `{ok:true}`; queues `file-open`; sets `result_emailed_at`; emits `result.requested` |
| `POST /api/portal/enter` | cookie | → `{ok:true}` and Supabase session cookies |
| `POST /api/auth/set-password` | session | `{password}` → `{ok:true}`; sets `password_set_at`; logs activity |
| `POST /api/auth/forgot` | none (rate limit) | `{email}` → `{ok:true}` always |
| `GET /api/portal/state` | session | → `{lead, application:{data,currentSection,completedAt}|null, documents:[{docType,status,fileName,uploadedAt,reviewNote}], booking, timeline…}` |
| `PUT /api/portal/application` | session | `ApplicationSaveInput` → `{ok:true, sectionsDone}`; first save sets `application_started_at`, stage `application`, status `application_incomplete`, emits `application.started` |
| `POST /api/portal/documents/upload-url` | session | `UploadRequest` → `{uploadUrl, token, path}` (Supabase signed upload URL, path from `documentPath()`) |
| `POST /api/portal/documents/confirm` | session | `{docType, path}` → `{ok:true}`; verifies the object exists, sets status `received`; emits `document.uploaded` |
| `DELETE /api/portal/documents/[docType]` | session | removes the file, status `missing` |
| `POST /api/portal/submit` | session | → `{ok:true, submittedAt}`; requires the application complete; sets `submitted_at`, stage `review`, status `application_submitted`; emits `application.submitted`; queues `application-received`; stops the nurture sequence |
| `POST /api/portal/tour-done` | session | `{ok:true}` |
| `POST /api/unsubscribe` | token in body | `{token}` → `{ok:true}`; sets `unsubscribed_at`; emits `unsubscribed` |
| `POST /api/cron/dispatch` | `Authorization: Bearer $CRON_SECRET` | schedules due nurture emails (`planDrip`), then delivers pending outbox events (`deliverPending`) → `{scheduled, skipped, delivered, failed}` |

Pages that are not API: `/go/[token]` (emailed portal link), `/auth/callback` (OAuth and recovery), `/unsubscribe`.
Admin mutations are **Server Actions** in `apps/campaign/src/app/[locale]/(admin)/admin/actions.ts` (each starts with `requireStaff()`), not public API routes.

Main site API: `POST /api/contact` (`ContactSubmissionInput`; honeypot; rate limit 5/min/IP; stores `contact_submissions`; emits `contact.created`; queues nothing else) in `apps/main`.

## 9. Outbox events

Always written with `enqueueEvent()` / `enqueueEmail()` from `@dpl/db/outbox` next to the change they describe, with a `dedupeKey` where a retry could repeat them. Types: `lead.created`, `lead.returned`, `booking.created`, `booking.cancelled`, `callback.requested`, `contact.created`, `account.created`, `application.started`, `application.submitted`, `document.uploaded`, `document.reviewed`, `status.changed`, `stage.changed`, `result.requested`, `unsubscribed` (CRM channel, payload always contains `lead: LeadSnapshot` plus event data) and `email.send` (email channel, payload `EmailPayload`). Emails are queued only through `queueEmail()` in `apps/campaign/src/server/email.ts`. Every CRM-relevant change also gets an `activity_log` row via `logActivity()` (`code` is a stable key, `text` is English).

## 10. Statuses and stages

`stage` (CRM board columns, `LEAD_STAGES`): lead → account → application → review → filed → granted; automatic transitions only move forward (`advanceStage`), staff can move any direction. `status` (what the applicant sees, `LEAD_STATUSES`): automatic ones are enquiry → account_created → application_incomplete → application_submitted (`advanceStatus` never overwrites a status staff set: under_review, info_required, review_completed, contacting). Changing the applicant-facing status in the CRM emits `status.changed` and queues the `status-update` email.

## 11. Ownership map

See the briefs. Files outside your ownership are read-only for you. Shared files owned by the coordinator: `apps/*/src/i18n/*`, `apps/*/src/middleware.ts`, `apps/*/src/app/[locale]/layout.tsx`, `apps/*/src/app/globals.css`, `apps/*/next.config.ts`, all of `packages/*`, `supabase/migrations/*`, `docs/*`.
