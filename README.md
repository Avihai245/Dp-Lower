# Decker Pex Levi: website and DP Lower campaign platform

Bilingual (English / Hebrew RTL) implementation of the Decker Pex Levi design handoff:

- **`apps/main`**: the law firm's website (`www.lawoffice.org.il`): 22 practice areas, 37 team members, articles, testimonials, contact, legal pages, full SEO and AI-discovery files.
- **`apps/campaign`**: the German/Austrian citizenship campaign (`euro-passports.com`): landing page, eligibility quiz, lead capture, free-call booking, personalised offer, client portal (application + document upload), and the firm's CRM at `/admin`.
- **Backend**: Supabase (Postgres with row level security, Auth, Storage, Realtime). Emails and CRM sync go through a transactional outbox delivered to Zapier.

Read [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for how it fits together (auth model, API, data, conventions) and [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) to put it into production.

## Quick start

```bash
pnpm install
pnpm db:start && pnpm db:reset          # local Supabase in Docker
pnpm dev:campaign                        # http://localhost:3001   (Hebrew: /he)
pnpm dev:main                            # http://localhost:3000
```

## Repository

```
apps/main, apps/campaign   Next.js 15 (App Router, React 19, next-intl)
packages/core              domain rules and schemas (pure TypeScript, unit tested)
packages/db                Supabase clients, outbox, auth/session plumbing
packages/ui                RTL-aware style helpers, base CSS, shared hooks
packages/i18n              typed firm content (en/he) and URL helpers
packages/emails            email templates (en/he)
supabase/                  migrations, config, SQL tests
tools/visual/              screenshot + diff tools to compare pages with the design prototypes
e2e/                       Playwright end-to-end tests
```

## Quality gates

| Command | What it checks |
|---|---|
| `pnpm typecheck` / `pnpm lint` | TypeScript and ESLint in every package and app |
| `pnpm test` | about 1,400 unit and integration tests (the integration ones need `pnpm db:start`): domain rules, schemas, email templates against the design's HTML, the nurture scheduler, auth plumbing against a real GoTrue, UI logic, message parity between English and Hebrew |
| `pnpm db:test` | SQL tests of the row level security, booking capacity and the outbox |
| `pnpm e2e` | Playwright against the production builds of both apps (start them first, see below): the funnel (API and UI), the client portal, the CRM, the firm website's forms and navigation, SEO crawl of the whole sitemap, security headers and CSP, an axe accessibility scan, and the full journey from the landing page to a reviewed case in English and Hebrew |

```bash
pnpm build
pnpm --filter @dpl/campaign start -p 3001 &    # http://localhost:3001
pnpm --filter @dpl/main start -p 3000 &        # http://localhost:3000
pnpm e2e                                       # or: pnpm exec playwright test e2e/journey.spec.ts
```

CI runs all of it on every push (`.github/workflows/ci.yml`).

## Documents

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md): contracts, data model, authentication model, API, outbox events.
- [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md): Supabase, Vercel, Zapier and environment variables, first staff user, launch checklist, operations.
- [`docs/HEBREW_REVIEW.md`](docs/HEBREW_REVIEW.md): where the Hebrew lives, the terminology chosen and the phrases that need a native reader.
- [`docs/AUDIT.md`](docs/AUDIT.md): the plan traced to the code and its tests, deviations from the design, and what is left for the firm to decide.
