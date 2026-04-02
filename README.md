# HelloBrand

HelloBrand is a creator-first partnership workspace for influencers and solo creators. The Phase 1 build uses Clerk auth, Prisma, Supabase-backed storage, and an intake-first workflow: sign in, start intake, upload or paste creator documents, confirm extracted metadata, and then manage the live partnership workspace.

## What is implemented

- Next.js App Router structure with public marketing pages and Clerk-protected `/app` routes
- Guided intake flow with resumable intake sessions and confirmation before partnership creation
- Multi-document partnership workspaces for contracts, briefs, decks, invoices, and pasted text
- Payments overview with one primary payout record per partnership
- Editable creator profile defaults for partnership and draft context
- Staged extraction pipeline with normalization, classification, sectioning, structured extraction, risk analysis, and summary persistence
- Editable partnership terms, evidence-backed watchouts, creator workflow statuses, and negotiation-ready email drafts
- API routes for intake, partnerships, reports, documents, drafts, payments, profile, contract alias upload, and document reprocessing
- Prisma schema for the planned Postgres production model

## Roadmap

- Expand creator profile onboarding beyond the intake modal into a fuller profile setup flow with handle-first defaults, payout details, and creator identity preferences across the app

## Stack

- Next.js + TypeScript
- Tailwind CSS
- Clerk with keyless mode support
- Prisma + Postgres
- Supabase Storage for uploaded files
- Inngest worker route for async document processing
- OpenRouter-first LLM stage support with section extraction, risk analysis, and summary refinement

## Local setup

1. Install Node.js 20+.
2. Install the Doppler CLI and link this repo to the shared dev config:

```bash
doppler setup --project hellobrand --config dev
```

3. Put your local secrets in Doppler. Use `.env.example` as the reference key list, then set values in the Doppler dashboard or upload an existing env file with:

```bash
doppler secrets upload .env --project hellobrand --config dev
```

4. Set `DATABASE_URL` to your Postgres connection string in Doppler. The authenticated `/app` routes expect a real database in this Phase 1 build.
5. Set `SUPABASE_URL` plus `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` for public Supabase clients. For server-side storage uploads, set `SUPABASE_SECRET_KEY` as well. Legacy `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` values still work as fallbacks. If omitted, file uploads fall back to local `.runtime/uploads`.
6. Fill in `OPENROUTER_API_KEY` in Doppler if you want live model analysis. The app uses an internal OpenRouter task router:
   - `OPENROUTER_MODEL_EXTRACT` for section extraction
   - `OPENROUTER_MODEL_RISKS` for risk analysis
   - `OPENROUTER_MODEL_SUMMARY` for creator-facing summaries
   - optional `*_FALLBACKS` secrets for per-task failover
   If the task-specific model is unset, it falls back to `OPENROUTER_MODEL`. If no provider is configured, the fallback parser is used.
7. Optional contract extraction pilot: set `LLAMA_CLOUD_API_KEY` for LlamaParse / LlamaExtract, then control the contract-only rollout with:
   - `LLAMA_EXTRACT_CONTRACTS_MODE=off|shadow|primary`
   - `LLAMA_EXTRACT_TIER=agentic|cost_effective`
   - `LLAMA_EXTRACT_TIMEOUT_MS` in milliseconds
   `shadow` keeps the existing contract extractor canonical and logs field-level diffs against LlamaExtract. `primary` makes LlamaExtract canonical for file-backed contracts and falls back to the legacy extractor on failure.
8. Fill in `INNGEST_EVENT_KEY` and `INNGEST_SIGNING_KEY` in Doppler if you want document processing to run through Inngest. If omitted, the app falls back to local fire-and-forget processing.
9. For Stripe-backed billing flows, set:
   - `STRIPE_SECRET_KEY`
   - `STRIPE_WEBHOOK_SECRET`
   - `STRIPE_PRICE_BASIC_MONTHLY`
   - `STRIPE_PRICE_STANDARD_MONTHLY`
   - `STRIPE_PRICE_PREMIUM_MONTHLY`
   - optional yearly price IDs if annual billing is enabled later
10. Optional for local packaging QA: set `HELLOBRAND_DEV_PLAN=basic|standard|premium` in a non-production environment to override the effective tier.
11. Optional for Playwright E2E: set `HELLOBRAND_E2E_ENABLED=1` and `HELLOBRAND_E2E_AUTH_SECRET` in a non-production environment to enable the local test-auth cookie flow.
12. Install dependencies:

```bash
pnpm install
```

13. Apply Prisma migrations and start the app:

```bash
pnpm exec prisma migrate deploy
pnpm exec prisma generate
pnpm run dev
```

Open [http://localhost:3011](http://localhost:3011).

`pnpm run dev` now runs `doppler run -- next dev --turbopack -p 3011` using the repo-scoped Doppler setup. If you need the raw Next.js command for debugging, use `pnpm run dev:next`. If Turbopack-specific behavior gets in the way while debugging, use `pnpm run dev:webpack` or `pnpm run dev:next:webpack`.

## Production config

Production secrets should live in the `hellobrand/prd` Doppler config, not in a local `.env` file and not copied blindly from dev. After populating the `prd` config in Doppler, use:

```bash
pnpm run build:prd
pnpm run start:prd
```

## Environment notes

- Clerk is configured for App Router and supports keyless mode for local development.
- Phase 1 app routes are authenticated and DB-backed. Marketing routes stay public.
- Uploaded files use Supabase Storage when configured, otherwise local `.runtime/uploads`.
- The app enqueues document processing. With Inngest credentials it uses the worker route under `/api/inngest`; without them it falls back to local fire-and-forget execution.
- The extraction pipeline remains section-based by default: extract text -> classify -> split sections -> section extraction -> merge -> risk analysis -> summary.
- When `LLAMA_EXTRACT_CONTRACTS_MODE` is enabled, file-backed contract documents can reuse the LlamaParse job and run through a contract-only LlamaExtract v2 path while keeping section persistence, risk analysis, summary generation, and term merge behavior unchanged.
- Billing entitlements resolve from Prisma/Postgres. Stripe drives checkout, subscriptions, invoices, and the customer portal.
- When `DATABASE_URL` is unset, the app falls back to the local file-backed seed store. The Playwright tier matrix uses this mode together with `HELLOBRAND_DEV_PLAN` and the non-production E2E auth cookie.

## API surface

- `GET /api/p`
- `POST /api/p`
- `GET /api/p/:dealId`
- `PATCH /api/p/:dealId`
- `POST /api/p/:dealId/contract` (temporary alias)
- `GET /api/p/:dealId/documents`
- `POST /api/p/:dealId/documents`
- `POST /api/documents/:documentId/reprocess`
- `GET /api/p/:dealId/report`
- `PATCH /api/p/:dealId/report`
- `GET /api/p/:dealId/drafts`
- `POST /api/p/:dealId/drafts`
- `POST /api/intake`
- `GET /api/intake/:sessionId`
- `POST /api/intake/:sessionId/retry`
- `POST /api/intake/:sessionId/confirm`
- `GET /api/payments`
- `PATCH /api/payments`
- `GET /api/profile`
- `PATCH /api/profile`

## Tests

Run:

```bash
pnpm test
```

The included tests cover fallback extraction, document parsing behavior, email draft generation, and unreadable document handling.

## Playwright E2E

The repo includes a local-first Playwright matrix for `basic`, `standard`, and `premium` entitlement coverage. It uses a single Next.js dev server with per-tier cookies instead of three separate servers. Tier switching happens via an `hb_e2e_tier` cookie set during global setup, so one server handles all three tiers.

Install browser binaries first:

```bash
pnpm exec playwright install chromium
```

### Running E2E tests

**Two-terminal approach (recommended, fastest):**

Terminal 1 (leave running):

```bash
doppler run -- pnpm test:e2e:server
```

Terminal 2:

```bash
doppler run -- pnpm test:e2e
```

Playwright detects the running server and skips startup entirely. Tests begin in seconds.

**Helpful variants:**

```bash
doppler run -- pnpm test:e2e:ui
doppler run -- pnpm test:e2e:headed
```

### How tier switching works

The `test:e2e:server` script starts a single dev server with `HELLOBRAND_E2E_ENABLED=1`. During Playwright global setup, each tier project (basic, standard, premium) gets a storage state file with an `hb_e2e_tier` cookie. The server reads this cookie via `getDevPlanOverrideAsync()` to determine which plan tier to simulate for that request.

### E2E test coverage

- Archive partnerships (dashboard, history table, row actions)
- Billing (plan cards, usage meters, checkout, stripe warning)
- Brief generation (tier gates, usage meters)
- Deal workspace (history, 404, dashboard)
- Delete partnership (confirmation flow)
- Form smoke tests (settings, profile, payments, notes)
- Inbox (locked preview, upgrade CTA, premium workspace)
- Intake flow (new workspace page)
- Invoices (draft generation)
- Navigation (sidebar, redirects, pricing, billing)
- Onboarding (guide tooltips, modal flow)
- Payments (page load)
- Public upload (anonymous analysis, quota gate, file validation)
- Search (page load, query handling)
- Settings (sub-tabs, email connections, notifications)
- Tier matrix (pricing cards, billing tiers, feature gates)
- Workspace nudges (notifications API, bell, terms tab)

## CI/CD

The repo is configured for this deployment split:

- Vercel Git integration stays enabled for preview deployments on non-`main` branches
- automatic Vercel Git deployments are disabled for `main` in [vercel.json](/Users/thomasroberts/Desktop/projects/hellobrand/vercel.json)
- GitHub Actions runs unit + E2E tests on pull requests and on pushes to `main`
- GitHub Actions deploys production to Vercel only after the test job passes on `main`

Workflow file:

- [.github/workflows/ci.yml](/Users/thomasroberts/Desktop/projects/hellobrand/.github/workflows/ci.yml)

Required GitHub repository secrets for production deploys:

- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`

Recommended repository settings:

- add the `CI / Test` job as a required status check in GitHub branch protection for `main`
- keep the Vercel project connected to GitHub for preview deployments
- make sure the Vercel project uses `main` as the production branch

## Stripe billing verification

Use Stripe sandbox/test mode first.

1. Create the `Basic`, `Standard`, and `Premium` products with monthly recurring prices in Stripe.
2. Put the Stripe secret, webhook secret, and price IDs into Doppler or your local env.
3. Apply Prisma migrations before testing billing:

```bash
pnpm exec prisma migrate deploy
pnpm exec prisma generate
```

4. Type-check the app before testing checkout:

```bash
pnpm exec tsc --noEmit
```

5. Run the focused billing rule tests:

```bash
pnpm exec vitest run tests/billing-rules.test.ts
```

6. Point the Stripe webhook endpoint at `/api/stripe/webhook` on your Vercel preview URL or a public local tunnel.
7. Subscribe the webhook to:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_failed`
   - `invoice.paid`
8. Complete a sandbox checkout from `/app/billing`, then confirm:
   - Stripe checkout succeeds or cancels cleanly
   - the webhook returns `200`
   - billing tables reflect the new state
   - locked upgrade surfaces route to billing or the Stripe portal correctly

For local webhook forwarding with Stripe CLI, use a listener instead of raw `localhost`, for example:

```bash
stripe listen --forward-to localhost:3011/api/stripe/webhook
```
