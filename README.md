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

`pnpm typecheck`, `pnpm lint`, `pnpm test` (unit + integration), `pnpm db:test` (SQL), `pnpm e2e`. CI runs them on every push.
