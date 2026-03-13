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
2. Copy `.env.example` to `.env`.
3. Set `DATABASE_URL` to your Postgres connection string. The authenticated `/app` routes expect a real database in this Phase 1 build.
4. Set `SUPABASE_URL` plus either `SUPABASE_SERVICE_ROLE_KEY` or `SUPABASE_ANON_KEY` if you want uploaded files stored in Supabase Storage. If omitted, file uploads fall back to local `.runtime/uploads`.
5. Fill in `OPENROUTER_API_KEY` if you want live model analysis. The default model is `openrouter/free`. If omitted, the fallback parser is used.
6. Fill in `INNGEST_EVENT_KEY` and `INNGEST_SIGNING_KEY` if you want document processing to run through Inngest. If omitted, the app falls back to local fire-and-forget processing.
7. Install dependencies:

```bash
pnpm install
```

8. Start the app:

```bash
pnpm exec prisma db push
pnpm exec prisma generate
pnpm run dev
```

Open [http://localhost:3000](http://localhost:3000).

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
