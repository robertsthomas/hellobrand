# HelloBrand

HelloBrand is a creator-first deal workspace for influencers and solo creators. The Phase 1 build uses Clerk auth, Prisma, Supabase-backed storage, and an intake-first workflow: sign in, start intake, upload or paste creator documents, confirm extracted metadata, and then manage the live deal workspace.

## What is implemented

- Next.js App Router structure with public marketing pages and Clerk-protected `/app` routes
- Guided intake flow with resumable intake sessions and confirmation before deal creation
- Multi-document deal workspaces for contracts, briefs, decks, invoices, and pasted text
- Payments overview with one primary payout record per deal
- Editable creator profile defaults for deal and draft context
- Staged extraction pipeline with normalization, classification, sectioning, structured extraction, risk analysis, and summary persistence
- Editable deal terms, evidence-backed watchouts, creator workflow statuses, and negotiation-ready email drafts
- API routes for intake, deals, reports, documents, drafts, payments, profile, contract alias upload, and document reprocessing
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
7. Fill in `INNGEST_EVENT_KEY` and `INNGEST_SIGNING_KEY` in Doppler if you want document processing to run through Inngest. If omitted, the app falls back to local fire-and-forget processing.
8. Install dependencies:

```bash
pnpm install
```

9. Start the app:

```bash
pnpm exec prisma db push
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
- The extraction pipeline is section-based: extract text -> classify -> split sections -> section extraction -> merge -> risk analysis -> summary.

## API surface

- `GET /api/deals`
- `POST /api/deals`
- `GET /api/deals/:dealId`
- `PATCH /api/deals/:dealId`
- `POST /api/deals/:dealId/contract` (temporary alias)
- `GET /api/deals/:dealId/documents`
- `POST /api/deals/:dealId/documents`
- `POST /api/documents/:documentId/reprocess`
- `GET /api/deals/:dealId/report`
- `PATCH /api/deals/:dealId/report`
- `GET /api/deals/:dealId/drafts`
- `POST /api/deals/:dealId/drafts`
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
