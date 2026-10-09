# Audit and traceability

What was built, how each part of the approved plan maps to code and tests, what was checked and by whom, where the system
deliberately differs from the design, and what only the firm can decide. Read it together with `ARCHITECTURE.md` (how the
code is organised), `DEPLOYMENT.md` (how to go live) and `HEBREW_REVIEW.md` (the Hebrew that needs a native reader).

## 1. How the system was checked

| Check | Where | What it proves |
|---|---|---|
| Unit and integration tests | `pnpm test` (Vitest; 83 files, 1,370+ tests) | Business rules (`@dpl/core`), the email templates (every template, both languages, structure, escaping, fidelity against the design's HTML), the nurture schedule and outbox against the real local Supabase, token and cookie handling, message parity (every English key has a Hebrew twin, same placeholders), Hebrew bidi guard, route lists |
| SQL tests | `pnpm db:test` (`supabase/tests/001..006` and `010`) | Schema, RLS (applicants read only their own rows, the Data API is read-only for signed-in users), booking capacity under concurrency, per-lawyer booking and the clean-up of past calls, outbox claiming, storage policies, case references, the Realtime publication and pinned function paths |
| End-to-end | `pnpm e2e` (Playwright, production builds, desktop + phone width, English + Hebrew; 230+ tests) | The whole journey (landing, quiz, details, booking, offer, password, portal, application, uploads, submit, CRM status change visible in the portal), every API route, the three firm-website forms, CRM actions and permissions, SEO of every sitemap URL, no console or CSP errors, no sideways scroll, axe accessibility scan of 40+ pages |
| Visual comparison | `tools/visual` | Screenshots of the prototypes next to the app at 1440 and 390 px; differences listed in section 4 |
| Independent audits (three agents that did not write the code) | this section | See 1.1 |
| Dependency audit | `pnpm audit --prod` | Clean after the `postcss` override |
| Database advisors | `pnpm exec supabase db advisors --local` | Security and performance advisors report nothing (migration 14 pinned the `search_path` of five helper functions). Run it again on the hosted project once it exists |

### 1.1 Independent audits and what became of their findings

Three audits were run against the finished system by agents that had not written it: backend and security, the campaign
against the design, the firm website against the design. Every finding was verified before it was fixed. `Fixed` means a
change plus a test; `Accepted` is a decision recorded in section 6; `Open` needs the firm.

**Backend and security (10 findings)**

| | Finding | Outcome |
|---|---|---|
| C-01 blocker | Any signed token was accepted as the lead cookie, so the never-expiring unsubscribe link logged people into the portal | Fixed: every token carries its purpose and the lead cookie only accepts `lead` with an epoch (`token.ts`, `lead-session.ts`; unit and e2e tests that an unsubscribe or portal token is refused as a cookie) |
| C-02 | Email links fell back to `localhost` in production | Fixed: `campaignSiteUrl()` falls back to `NEXT_PUBLIC_SITE_URL`; documented |
| C-03 | Rate limits trusted the left-most `X-Forwarded-For` | Fixed: `clientIp()` uses `x-vercel-forwarded-for`, `x-real-ip`, then the right-most entry (`client-ip.test.ts`) |
| C-04 | Any staff role could wipe the call template, forge history and rewrite leads through the Data API | Fixed: the Data API is read-only for signed-in users, all writes go through server code with `requireStaff`/`requireAdmin` (migration 9, `004_read_only_api.sql`) |
| C-05 | `script-src 'unsafe-inline'` | Accepted (6) |
| C-06 | `existing` vs `created` shows whether an address already has a file | Accepted (6) |
| C-07 | No `List-Unsubscribe` | Fixed: `listUnsubscribe` in the email payload and the Zapier mapping |
| C-08 | No way to erase an applicant; files outlived the row | Fixed: admin "Delete applicant" (files, sign-in user, rows, events; `deletion_log`; `lead.deleted`) |
| C-09 | The campaign details form records no consent | Open: legal decision (7) |
| C-10 | `postcss` advisories | Fixed (override) |

**Campaign against the design (19 findings)**

| | Finding | Outcome |
|---|---|---|
| B-01 | (same as C-01) | Fixed |
| B-02 | Emails 2 and 4 went to people who had uploaded some documents | Fixed: skipped as soon as one document is in |
| B-03 | Queued nurture emails still went out after unsubscribe or submission, or as a burst after downtime | Fixed: pending nurture events are cancelled on unsubscribe, submission, a corrected address and a deleted lead; events older than 48 hours are never delivered; new event state `cancelled` |
| B-04 | Case references repeated after about 9,000 leads | Fixed: five or more digits, the email conflict is told apart from a case-reference conflict (migration 12, `005_case_ref.sql`) |
| B-05 | A booked call could not be moved or cancelled; links in emails led to dead ends; past calls stayed "upcoming" | Fixed: see 1.2 |
| B-06 | Google sign-in or a reset link opened the portal without the lead reaching "Account created" | Fixed: `markAccountCreated()` (idempotent, one CRM event) is called from the auth callback too |
| B-07 | Correcting the email on /details created a second lead | Fixed: the same lead moves to the new address (identity reset, old links dead, welcome-1 and the booking confirmation to the new address); another name is another person; a lead with a password keeps its address |
| B-08 | One firm-wide pool of call slots, bookings never assigned | Fixed: see 1.2 |
| B-09 | The quiz draft stayed in the browser | Fixed: cleared once the details are saved and on sign-out, the quiz resumes from the file, answer changes are saved to it |
| B-10 | A later deep link did not change where "Back to the site" goes | Fixed: separate `dpl_from` cookie; the first touch stays in `dpl_src` |
| B-11 | "N free calls left this week" never showed with real data (it was hidden above six) | Fixed: the line shows the real number of free seats from now to the end of the firm's week and is absent when there are none (`seatsThisWeek`; unit and e2e tests) |
| B-12 | Saving details in the CRM sent no email | Fixed: `details-changed` email to the new address, a notice without links to the old one; the designed "gets an email confirming the change" |
| B-13 | The portal's email field is read-only | Open: needs the firm's approval (6) |
| B-14 | A status the team set before submission was invisible in the portal | Fixed: shown on the dashboard and in the stage line |
| B-15 | Google-created leads never got the nurture sequence | Fixed: they join once they have answered the questions |
| B-16 | Detail changes and document removals never reached Zapier | Fixed: `lead.updated`, `document.removed` |
| B-17 | Application progress was not live in the CRM | Fixed: `applications` in the Realtime publication |
| B-18 | Hebrew quiz footer squeezed at 390 px | Fixed (e2e test at phone width in both languages) |
| B-19 | Three different Hebrew labels for the same statuses | Fixed: the Lead Flow HE wording everywhere |

**Firm website against the design (11 findings; the English site matched the prototype almost pixel for pixel)**

| | Finding | Outcome |
|---|---|---|
| A-01 major | The 404 page was an empty shell without a title | Fixed: the middleware answers unknown URLs with a server-rendered 404 page (status 404, title, language, direction, noindex); the list of pages is compared with the app directory by a test |
| A-02 | "116(2)" displayed as "(2)116" in Hebrew; phone numbers broke at the hyphen | Fixed: left-to-right isolates (a guard test covers every Hebrew string), `<Ltr>` for phones |
| A-03 | Old `#/` links did not resolve | Fixed (`LegacyHash`); `?p=` redirects keep the query string |
| A-04 | `llms-full.txt` lacked the common-questions section | Fixed (single source: the campaign's questions) |
| A-05 | UTM and source were lost | Fixed: first-touch parameters kept for the session and sent with all three forms and in `contact.created` |
| A-06 | Lighthouse mobile 87 on `/he` and `/team` | Partly fixed: the header logo is a 240 px copy (11 KB instead of 47 KB); measured results in 1.3 |
| A-07 | A hover-opened menu could not be closed with Escape | Fixed |
| A-08 | Clicking the dimmed send button did nothing | Fixed: the click shows what is missing |
| A-09 | Pill counts and a reordered privacy paragraph were not in the design | Fixed: back to the design |
| A-10 | Firm structured data only on the home page; no share image size | Fixed: on every page; a 1200x630 share image with size and alt text |
| A-11 | Colour contrast of the palette | Open: a design decision, proposal in 7 |

### 1.1b Second round (after the per-lawyer calendars were added)

Four more agents that had not written the code: the plan against the code, the campaign and the CRM used the way people use them, the
firm website, and the security of everything that changed since the first audit. They found one blocker, three major findings
and about twenty smaller ones. Each was reproduced before it was fixed; a fix has a test. IDs: S = security, P = plan, F = campaign
and CRM in use, W = firm website.

| | Finding | Outcome |
|---|---|---|
| S-1 blocker | A lead made with the address of an existing sign-in account (a member of staff, an account somebody registered by hand) became a way into that account: "Go to my portal" signed the browser in as it, with no password and no email | Fixed: a lead links only an account the server made for it (`app_metadata.lead_id`); an emailed link, which proves the mailbox, may adopt one that no other lead holds and replaces its password and sessions; a staff account is never adopted and `openPortalSession` never signs anyone in as staff; the CRM edit and the applicant's address correction refuse such an address. Integration, e2e and unit tests (`portal-session.int.test.ts`, `funnel.api.spec.ts`) |
| S-2 | Line breaks and other control characters in a name, phone number, source or message reached the stored lead and the recipient name of every email (a header-injection primitive for whatever builds the header) | Fixed: the form schemas clean them, names also lose `< > " \`, phone numbers keep digits and separators, the recipient name in the outbox is plain text; the email expression is the ASCII one a mail provider takes |
| P-1 major, W-1 | `/favicon.ico`, `/wp-login.php`, `/.env`, `/index.html` and every other single path segment with a dot answered 500 on both apps | Fixed: they pass through the middleware: the files that exist (new `favicon.ico`, `apple-touch-icon.png`, `robots.txt`, `sitemap.xml`, `llms*.txt`) are served, anything else is a server-rendered 404; a test compares the list with `public/` and the app directory |
| P-2 major | The `List-Unsubscribe` header pointed at the confirmation page, so a mail provider's one-click POST (RFC 8058) unsubscribed nobody | Fixed: `/api/unsubscribe/one-click` takes the POST (the signed token is the authority); a browser's GET gets the page that asks |
| F-1 major | After the typo correction (Back from the booking), the booking confirmation queued for the mistyped address stayed pending and carried the name, the phone number and the time of the call | Fixed: everything queued for the old address is withdrawn by the correction and by the team's edit; the dispatcher refuses at delivery any email whose recipient is no longer the lead's address |
| W-2 major | English header: from 1025 to about 1250 px the nav ran under the two buttons (the prototype does the same) | Fixed for English between 1025 and 1270 px (the nav takes its own row, as below 1025 px); Hebrew fits and is left as designed. A design change in the strict sense: the firm should look at it |
| F-2, F-7 | The confirmation of a call that was moved or cancelled still went out; three status clicks in three seconds sent three emails | Fixed: an undelivered confirmation is withdrawn; the applicant gets the last status email only |
| F-3 | A name of 120 letters without a space pushed the CRM table and lead page off the screen | Fixed (the table cuts it with an ellipsis, the panels wrap it) with a test |
| F-4 | The "Free call" panel vanished after "Mark call held" while the slot was still running | Fixed |
| F-6 | The English campaign pages downloaded the Hebrew fonts (the language switch was prefetched) | Fixed (`prefetch={false}`) with a test |
| F-10 | Without scripts the landing figures read "0+ / 0%" | Fixed (`noscript` style shows the real figures) with a test |
| W-3, W-4 | A lead band submitted before the script ran put name, phone and email into the address bar; the contact button dropped keyboard focus while sending | Fixed (POST, a "needs JavaScript" note, `aria-disabled`) |
| W-5, W-6, W-9, W-11 | A page's own `utm_*` were mixed with the first touch's; the contact page's eligibility link took a redirect; structured data and `llms.txt` carried invisible direction marks; `/en/...` redirected with 307 | Fixed |
| P-4, P-5 | No limit on three public GET routes, no `Retry-After`; the nurture sequence ignored statuses the team set before the stage moved | Fixed (300 a minute per address, `Retry-After` on 429; a team-set status stops the sequence, also at delivery) |
| P-6, P-9 | The email-fidelity tests skipped silently away from the author's machine; images were served with `max-age=0` | Fixed (the sixteen design emails are in `packages/emails/fixtures/design`; a day of cache plus a week of stale-while-revalidate) |
| P-3, P-7, P-8, P-12 | No Lighthouse evidence; stale paths and test counts in the documents; differences from the plan not written down | Fixed (section 1.3, sections 2 and 3) |
| F-5 | `<script>1234567</script>` accepted as a phone number, quoted and non-ASCII addresses accepted | Fixed with S-2 |
| F-9 | Funnel screens without a `<main>`; some touch targets under 24 px (Sign out, "Set a password", "← Portal", the camera buttons) | `<main>` added; the target sizes are the design's own and stay (WCAG 2.2 level AA, which Israeli standard 5568 does not require) |
| F-8 | Applicants cannot remove an uploaded file | Decision recorded: the design has no remove control, an upload can be replaced; the API route and the `document.removed` event exist for a later step |
| F-12 | Browser Back inside the six questions leaves the quiz (they share one URL) | Accepted: the quiz is one screen with its own "Previous"; progress is kept |
| F-11 | "No confirmation after saving in the CRM modal" | Not a defect: the button reads "Saved" and the line below says the applicant is emailed (an e2e test asserts both) |
| W-7, W-8 | 71 of 156 titles are over 65 characters (the prototype's "name, role \| brand" formula); `lastmod` is the date of the content snapshot on most URLs | Open for the firm (titles); the date is deliberate and documented in `crawl.ts` |
| P-10, P-11, P-13 | HMAC signing and Turnstile are off until their secrets are set; the campaign `llms.txt` lists `/eligibility`, which `robots.txt` disallows; "Mark received" on an empty slot counts as a document for the drip rule | Accepted: documented as recommended in `DEPLOYMENT.md`; the funnel's first step stays listed for answer engines; the firm holds a document it marked received |
| other nits | 22 px "Open in maps" targets, the chat teaser over the hero on 390 px phones, day chips wrapping 4+1, any ZIP accepted as `.docx`, an eight-character password minimum, repeated wrong sign-ins throttled only by Supabase Auth's own limits (hosted default 30 per 5 minutes per address) | Accepted or recorded; none changes the design |

### 1.2 Per-lawyer availability and the booking lifecycle (B-05, B-08)

See the section "Booking" of `ARCHITECTURE.md`. Summary of the behaviour: each lawyer has their own weekly hours and blocked
days (an administrator edits any calendar, a lawyer only their own; the former firm-wide template stays as the
"unassigned" pool so nothing breaks before lawyers are set up); a booking is assigned to a free lawyer; emails carry a signed link to a page where the
visitor can move or cancel the call; a call whose time has passed is never shown as upcoming and is marked completed by the
cron job; staff can mark a call held, no-show or cancelled.

### 1.3 Measured performance and accessibility

Lighthouse (local production builds, mobile preset): see the table at the end of this section after the final run.
axe (WCAG 2.0/2.1 A and AA) finds no violation other than colour contrast on any of the pages scanned, in either language.

## 2. Plan to implementation

| Plan stage | Implemented in | Verified by |
|---|---|---|
| 0 Infrastructure: monorepo, lint, tests, CI, env examples, assets, robots/llms | `pnpm-workspace.yaml`, `packages/*`, `apps/*`, `.github/workflows/ci.yml` (verify, database + integration, build, Playwright), `.env.example` files, `app/{robots,sitemap}.ts`, `llms*.txt` routes | CI; `e2e/seo.spec.ts`, `e2e/hygiene.spec.ts` |
| 1 Design system | `packages/ui` (tokens, fonts, `s()`/`x()` direction-aware styles, `RevealObserver`, hooks); the components that only one site uses stay in that site: header, footer, accessibility widget, chat, sticky call to action, mega menu in `apps/main/src/components/shell`; header, hero video, review marquee, count-up figures, advisor and chat in `apps/campaign/src/components/landing` | `e2e/main.spec.ts`, `e2e/a11y.spec.ts`, `tools/visual` |
| 2 i18n | next-intl, `/` and `/he`, `lang`/`dir`, hreflang, message parity test, French removed from the language switch | `apps/*/src/i18n/messages.test.ts`, `e2e/seo.spec.ts`, `packages/i18n/src/bidi.test.ts` |
| 3 Firm website | `apps/main` (home, about, services + 22, team + 37, testimonials, insights + 8, media, contact, legal, 404); forms with zod on both sides; campaign links; SEO and structured data | `e2e/main.spec.ts`, `e2e/seo.spec.ts` (every sitemap URL), unit tests of the pure parts |
| 4 Landing page and funnel | `apps/campaign` (21 landing sections, chat, advisor, six-question quiz, details, booking, offer, deep links) | `e2e/funnel.api.spec.ts`, `e2e/funnel.ui.spec.ts`, `e2e/journey.spec.ts` |
| 5 Client portal | `apps/campaign/src/components/portal`, `src/app/api/portal/**` (tour, five-section application with autosave, uploads straight to private storage, submit) | `e2e/portal.api.spec.ts`, `e2e/portal.ui.spec.ts`, `e2e/journey.spec.ts` |
| 6 CRM | `/admin` (list and board, lead card, documents, notes, activity, status, edit details, availability, inbox, team, Realtime) | `e2e/admin.*.spec.ts` |
| 7 Emails | `packages/emails` (Lead Email, Welcome 1-15, ten transactional templates, English and Hebrew), `apps/campaign/src/server/{email,drip}.ts`, `packages/core/src/drip.ts`, outbox and dispatcher in `packages/db` | `packages/emails/src/*.test.ts`, `server/drip.test.ts`, `outbox.int.test.ts`, `dispatch.test.ts` |
| 8 SEO, performance, security, accessibility | Structured data, sitemaps, CSP and headers, rate limits, Turnstile, honeypots, HMAC signed webhooks, focus and reduced motion | `e2e/a11y.spec.ts`, `e2e/hygiene.spec.ts`, `e2e/seo.spec.ts`, SQL tests |
| 9 Tests and launch | The suites above; `DEPLOYMENT.md` | CI |

### 2.1 The 13 steps and 6 statuses of Lead Flow

| Step | Where |
|---|---|
| 01 Landing page | `apps/campaign/src/components/landing`, deep links `?entry=&source=` in `middleware.ts` |
| 02 Eligibility questionnaire | `components/funnel/EligibilityQuiz.tsx`, `packages/core/src/quiz.ts` |
| 03 Contact details | `components/funnel/LeadForm.tsx`, `POST /api/leads` (`server/leads.ts`) |
| 04 Free consultation call | `components/funnel/BookingPicker.tsx`, `/api/availability`, `/api/bookings`, `book_slot()` |
| 05 The call with the lawyer / the AI advisor | the lawyer's call is offline; "Speak with an AI Advisor" records a callback request (`/api/callbacks`, CRM inbox); the voice AI is a later step |
| 06 Personalised offer | `components/funnel/OfferView.tsx`, `logic/offer.ts` |
| 07 Create a password | `/create-password`, `/api/auth/set-password`; the account is linked to the existing lead (`portal-session.ts`) |
| 08 Portal opens | `components/portal/Dashboard.tsx` |
| 09 Complete the application | `components/portal/ApplicationEditor.tsx`, `useApplicationAutosave.ts`, autosave to `applications` |
| 10 Upload the records | `components/portal/DocumentsScreen.tsx`, `useDocumentUploads.ts`, signed upload URLs, private bucket |
| 11 Submit | `submitApplication` (`server/portal-application.ts`): status, `application.submitted`, nurture stops |
| 12 The team reviews and sets the status | CRM status panel, `status.changed` + email, visible in the portal at once (also before submission) |
| 13 The client follows the case | portal sign-in, status page, emails |

Statuses: enquiry, account created, application incomplete, application submitted, under review, additional information
required (plus the two the prototype's staff control adds: review completed, contacting applicant). Stages and statuses
are in `ARCHITECTURE.md` section 10.

## 3. Differences from the plan

| Plan | Built | Why |
|---|---|---|
| Turborepo | pnpm workspaces and `pnpm -r` scripts | Two apps and five packages; no build graph to cache |
| Fonts with `next/font/google` | Self-hosted `@fontsource-variable` packages | No request to a third party at run time (the CSP keeps `font-src 'self'`), no network needed at build time; same families |
| `dispatch-events` Supabase Edge Function and `pg_cron` every 15 minutes | A Next.js route `/api/cron/dispatch` called by Vercel Cron every 5 minutes (or by `pg_cron` + `pg_net`, `supabase/snippets/dispatch-cron.sql`) | One codebase, testable with Vitest, one place for the secrets |
| Supabase project created up front | Everything runs on the local Supabase stack | Waits for the firm's confirmation of the cost (section 7) |
| `documents.status`: empty, uploading, uploaded, approved, rejected, requested | `missing`, `requested`, `received`, `reupload` | The CRM's own words (the design's staff controls: "Mark received", "Request again"); an upload in progress is client state, approval is "received" |
| `applications.sections` and `progress` | `applications.data` (all answers) and `current_section`; progress is computed from the data | One document per applicant, the five sections are a view of it |
| Dates as ISO with `Intl` formatting | Dates stay as the design's display text and are parsed into ISO where a machine needs them (`apps/main/src/lib/dates.ts`) | Keeps the content files identical to the design; the structured-data error is fixed |
| Client validation with the same zod schema | Client rules mirror the zod schema (`packages/core/src/schemas.ts`); the server always validates with zod | Keeps zod and the server code out of the browser bundle |
| Uploads: PDF, JPG, PNG, HEIC up to 20 MB | Also HEIF, WebP and Word (`.docx`), same limit, checked by sniffing the real file type | Applicants hold records in these formats |
| Links from the firm site: `euro-passports.com/?entry=…&source=main-site` | `/eligibility?source=main-site` and `/sign-in?source=main-site` (`?entry=` works too) | One redirect fewer; both set the same cookies |
| Nurture stops on submission, unsubscribe or a closed status | Also when the case has moved past the application or the team has set a status (under review, more information needed, review completed, contacting); an email overdue by more than 36 hours is skipped, not sent late; queued emails older than 48 hours are cancelled; at least 20 hours between two emails | Nobody gets a burst after downtime or an email for a case that has moved on |

## 4. Differences from the design (each needs the firm's eye)

1. **Portal "My details": the email field is read-only** (prototype: editable). An email change must be proven by the new
   mailbox; staff can change it in the CRM. *Needs approval or a verified email-change flow.*
2. **"Speak with an AI Advisor"** records a "call me" request and says so; the prototype showed a countdown to a call that no
   system places. *Wording to approve.*
3. **Screens the design did not have**, built in the same visual language: the expired-link page, the unsubscribe page,
   "we emailed you a link", sign-in error states, the 404 page, loading and error boundaries, the status banner on the
   portal dashboard when the team sets a status before submission, the locked email note on /details for applicants who are
   signed in, the "Delete applicant" panel and the lawyer calendar controls of the CRM, the cancel/change panel of the booking
   step. Their Hebrew and English are new text (`HEBREW_REVIEW.md`).
4. **Icons.** The design names the logo file as the page icon; `favicon.ico` and `apple-touch-icon.png` (browsers and crawlers ask
   for them by name) are made from the logo's monogram, the "D·P" with the gold ball, the part that stays readable at 16 px.
5. **French** was removed from the language switch (as planned); the burger menu of the firm website gained the
   English/Hebrew switch because the utility bar is hidden on phones.
6. **Prototype bugs fixed** (as planned): the office map links, the video on phones, the Hebrew date error in the
   structured data, the duplicate `offices` definition, and, found by the second audit, the English header whose nav ran under
   its two buttons from 1025 to about 1250 px (in that range the nav now takes its own row, as it does below 1025 px).
   *The firm should look at this one: it is the only place where the layout differs from the prototype at a width the
   prototype can be shown at.*
7. **Placeholders kept exactly as designed** and marked in the pages: the 30% reduction, the figures, 4.9 / 380+ reviews, the
   case study, "Draft for review" on the legal pages.

## 5. Known limitations

- **Unknown campaign URLs**: the response has status 404 and a title, but the visible 404 content is drawn by the browser
  (Next.js sends a page that calls `notFound()` as an empty shell). The firm website does not have this limitation: it
  rewrites unknown URLs to a real page.
- **Lighthouse on the deployed site** has not been measured (the hosted sites do not exist yet); local numbers depend on the machine.
- **Email clients**: the templates are table-based with inline styles and are tested for structure, escaping and fidelity to
  the design's HTML, not rendered in Gmail, Outlook or Apple Mail.
- **Browsers and devices**: tested in Chromium (desktop and phone width). Safari, Firefox, real phones and screen readers
  need a human pass; so does the Israeli standard 5568 beyond what axe can check.
- **Not exercised without credentials**: delivery to a real Zapier hook, "Continue with Google", Cloudflare Turnstile.

## 6. Accepted risks and decisions on record

- **CSP `script-src 'unsafe-inline'`** (C-05): the pages are static, a nonce would make them all dynamic; no place renders
  visitor-supplied HTML; everything else in the policy is closed. Revisit with nonce + `strict-dynamic` if the firm wants a strict policy.
- **"We have emailed you a link" reveals that an address already has a file** (C-06): this is the designed step 07
  ("an account linked to the existing enquiry"); the answer is the same shape for every known address, carries nothing of
  the file, is rate limited per address and never changes the file.
- **No automatic data purge**: erasure is a deliberate administrator action; the firm decides the retention period.

## 7. For the firm to decide or supply before launch

1. **Legal texts** (privacy, terms, accessibility statement) and the consent model: today the firm website's forms record
   consent, the campaign funnel does not (C-09). If a consent basis is adopted, add the checkbox to the details step and
   store `consented_at` (the column and the server code exist).
2. **Hebrew**: a native reader for everything in `HEBREW_REVIEW.md`.
3. **Marketing claims** flagged "To verify": 30% reduction, figures, reviews, case study, fee model.
4. **Eligibility criteria**: `evaluateEligibility()` in `packages/core/src/quiz.ts` reads only the route and the closest relative.
5. **Accounts and values**: Zapier Catch Hook URLs (and the Zaps), the sender address and reply-to, domains, the Google OAuth
   client, a Turnstile site if wanted, the Instagram link.
6. **Lawyers and hours**: create the lawyers as staff and give each their weekly hours in `/admin/availability`.
7. **Colour contrast.** The palette is kept as designed. axe reports contrast shortfalls; the smallest changes that would
   fix most of them: grey `#9c958a` (2.7:1 on cream) to about `#6f685e`; bronze `#a07a3c` for small text on light
   backgrounds (3.6:1) to `#7a5c2c`, which is already in the palette; the dimmed send button text. Every other accessibility
   rule passes.
8. **Retention period** for applications and documents.
9. **What the privacy policy must say about cookies and browser storage.** Nothing is used for advertising or analytics;
   the inventory is: campaign cookies `dpl_lead` (httpOnly, 30 days: proves this browser created the lead), the Supabase
   sign-in cookies (portal and CRM sessions), `dpl_src` and `dpl_utm` (30 days: where the visitor first came from, for the
   lead's source) and `dpl_from` (30 days: where "Back to the site" goes); campaign local storage `dpl-quiz-v1` and
   `dpl-lead-draft-v1` (the unsent answers and details; cleared when the details are saved or the applicant signs out);
   firm website local storage `dpl-a11y` (accessibility settings) and session storage `dpl-attribution` (first-touch
   campaign parameters and referring site until the tab closes, sent with an enquiry form). Third parties: embedded
   YouTube videos (`youtube-nocookie.com`, loaded on the home pages and the media page) and, if the firm turns it on,
   Cloudflare Turnstile on the public forms.
10. **Cost confirmation for the hosted Supabase project** (a new project in an organisation of the firm's account). Nothing has been created.
11. **Voice AI** for the advisor: the button, the callback queue and the event are in place; the provider is a later step.

## 8. How to repeat the checks

```bash
pnpm typecheck && pnpm lint && pnpm test      # unit + integration (needs the local Supabase for the integration files)
pnpm db:test                                    # SQL tests
pnpm build                                      # both apps
# start both production servers (ports 3000 and 3001), then:
CAMPAIGN_URL=http://localhost:3001 MAIN_URL=http://localhost:3000 pnpm e2e
```
