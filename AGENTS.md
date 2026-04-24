# AGENTS.md

This file provides AI agents and automated tools with comprehensive information about the HelloBrand codebase to enable effective assistance with development tasks.

## Maintenance

Keep this file up to date. Update it when:

- New features or domain modules are added
- Directory structure or file paths change
- New API routes, server actions, or pages are created
- Tech stack, dependencies, or tooling changes
- Feature flags are added, renamed, or removed
- New E2E test coverage areas are added
- Deployment or CI/CD config changes
- Architectural patterns or layering rules evolve

When in doubt, update it. An outdated AGENTS.md is worse than no AGENTS.md.

## Project Overview

**HelloBrand** is a creator-first partnership workspace for influencers and solo creators. The application provides an intake-first workflow: sign in, start intake, upload or paste creator documents, confirm extracted metadata, and then manage the live partnership workspace.

### Core Purpose

A unified platform for creator partnership management that enables users to:

- **Intake & Document Processing**: Guided intake flow with resumable sessions, multi-document upload, and AI-powered extraction pipeline
- **Partnership Workspaces**: Manage contracts, briefs, decks, invoices, and pasted text in one place
- **Smart Inbox**: Email-based inbox with AI drafting, thread linking, and candidate discovery
- **Billing & Subscriptions**: Tiered plans (Free/Basic/Premium) powered by Stripe with usage-based entitlements
- **AI Analysis**: Document extraction, risk analysis, conflict intelligence, and summary generation via OpenRouter
- **Invoice Management**: Invoice generation, editing, and PDF export
- **Profile & Settings**: Creator profile defaults, payment details, email connections, and notification preferences

## Technical Architecture

### Frontend Stack

- **Next.js 16** with App Router and Turbopack for development
- **React 19** with TypeScript 5.8 for type-safe UI
- **Tailwind CSS** with `@tailwindcss/forms` for styling
- **shadcn/ui** (new-york style) with Radix UI primitives for component library
- **Framer Motion** for animations
- **next-intl** for internationalization
- **next-themes** for dark mode support
- **Zustand** for complex cross-tree client state (sparingly used)
- **cmdk** for command palette

### Backend Stack

- **Next.js API Routes** for HTTP endpoints under `app/api/`
- **Next.js Server Actions** for authenticated mutations under `app/server-actions/`
- **Prisma** ORM with multi-file schema in `prisma/schema/` and Postgres database
- **Supabase Storage** for uploaded files (local fallback to `.runtime/uploads`)
- **Inngest** for async durable job processing (document pipeline, email sync, reminders)
- **OpenRouter** for LLM calls (extraction, risk analysis, summaries) with task-specific model routing
- **Azure Document Intelligence** for PDF/DOCX text extraction (optional, local parsers as fallback)
- **Clerk** for authentication with keyless mode support

### Integrations & Services

- **Stripe** for billing, checkout, subscriptions, invoices, and customer portal
- **Resend** for transactional email
- **React Email** for authoring email templates in `emails/` and uploading them to Resend
- **LaunchDarkly** for feature flags
- **PostHog** for analytics and feature flags (secondary)
- **Sentry** for error tracking and performance monitoring
- **Doppler** for secrets management

### Build System & Development

- **pnpm** as package manager
- **React Email CLI** for local email preview/build workflows (`pnpm run email:dev`, `pnpm run email:build`)
- **Biome** for linting and formatting (replaces ESLint + Prettier)
- **Vitest** for unit tests (Node environment)
- **Playwright** for E2E tests with tier matrix (free/basic/premium)
- **TypeScript** strict mode with `noEmit`
- **Docker** for Fly.io deployment (app + Inngest worker)
- **Standalone output** for containerized deployment

### Deployment & Infrastructure

- **Fly.io** for production hosting (separate app + Inngest worker machines)
- **Vercel** for preview deployments on non-main branches
- **GitHub Actions** for CI/CD (lint, typecheck, test, deploy)
- **Doppler** for environment and secrets management across dev/prd configs

## Architecture Patterns

### Single-App Structure

The codebase is a single Next.js application (not a monorepo) with a clear layered architecture:

```
app/              # Next.js route tree (API routes, pages, layouts, server actions)
components/       # Reusable UI components (feature components + shadcn primitives)
emails/           # React Email templates, organized by email category (e.g. transactional/)
lib/              # Domain logic, orchestration, data access, shared utilities
prisma/           # Prisma schema (multi-file) and migrations
hooks/            # Shared React hooks
types/            # TypeScript declarations for third-party modules
i18n/             # Internationalization config and routing
tests/            # Vitest unit tests + Playwright E2E tests
scripts/          # Build scripts, deployment scripts, worker entrypoint
docs/             # Architecture docs and design system docs
```

### Skip List — Directories to Ignore Unless Specifically Relevant

```
.next/, .runtime/, node_modules/, generations/, output/, test-results/,
tmp/, supabase/.temp/, tests/e2e/.auth/, public/vendor/
```

### Task Router — Where to Start by Task Type

| Task Type                          | Start Here                                                                    |
| ---------------------------------- | ----------------------------------------------------------------------------- |
| Intake / document upload           | `lib/intake.ts`, `lib/intake/`, `app/app/intake/`, `app/api/intake/`          |
| Document processing / extraction   | `lib/analysis/`, `lib/pipeline/`, `lib/documents/`                            |
| Partnership / deal workspace       | `lib/deals.ts`, `lib/deals/`, `app/app/p/`, `app/api/p/`                      |
| Smart inbox / email                | `lib/email/`, `components/inbox-workspace/`, `components/inbox-workspace.tsx`  |
| Email templates                    | `emails/marketing/`, `emails/transactional/`, `emails/shared/`, `lib/welcome-email.ts`, `lib/waitlist-email.ts`, `lib/notification-email.ts`, `lib/feedback.ts`, `messages/*.json` |
| Billing / subscriptions / Stripe   | `lib/billing/`, `app/app/billing/`, `app/api/stripe/`                         |
| AI assistant                       | `lib/assistant/`, `components/assistant-*.tsx`                                |
| Risk analysis / conflict intel     | `lib/analysis/risks/`, `lib/conflict-intelligence.ts`, `lib/conflict-categories.ts` |
| Invoice generation / PDF           | `lib/invoices.ts`, `lib/invoice-pdf.ts`, `components/invoice/`               |
| Profile / settings                 | `lib/profile.ts`, `lib/profile-draft.ts`, `app/app/profile/`, `app/app/settings/` |
| Payments                           | `lib/payments.ts`, `lib/payment-summary.ts`, `app/app/payments/`              |
| Notifications                      | `lib/notifications.ts`, `lib/notification-service.ts`, `app/app/notifications/` |
| Onboarding                         | `lib/onboarding.ts`, `lib/onboarding-draft.ts`, `app/app/onboarding/`        |
| Feature flags                      | `flags.ts`, `lib/launchdarkly.ts`                                             |
| Public pages / marketing           | `app/[locale]/`, `app/blog/`, `app/upload/`, `app/sample/`                   |
| Admin tools                        | `app/admin/`, `lib/admin-*.ts`                                                |
| UI primitives                      | `components/ui/`                                                              |
| Shared hooks                       | `hooks/`, `components/use-*.ts`                                               |
| Database schema / migrations       | `prisma/schema/`, `prisma/migrations/`                                        |
| Inngest background jobs            | `lib/inngest/`, `scripts/inngest-worker.ts`                                   |
| E2E tests                          | `tests/e2e/`                                                                  |
| Deployment                         | `scripts/fly-deploy-*.sh`, `Dockerfile.app`, `Dockerfile.inngest-worker`, `fly*.toml` |

### Key Design Principles

- **Layer separation**: Route/UI layer → Action layer → Domain layer → Repository layer → Analysis layer
- **Route files are thin**: Pages orchestrate data loading and component composition only
- **Server actions validate and delegate**: Verify viewer, parse input, call one domain command, revalidate/redirect
- **Domain logic in `lib/`**: Business rules never live in components or route handlers
- **Repository pattern**: `lib/repository/` hides Prisma/file-store details behind a stable interface
- **Components are UI-only**: Rendering and interaction only; no business rules
- **Feature-local state**: Complex client orchestration lives in `components/use-*.ts` hooks
- **Zustand is rare**: Only for truly cross-tree, client-only state (e.g., intake UI store)
- **Prisma/Postgres is the source of truth**: Clerk is identity only, Supabase is file storage only
- **Doppler for secrets**: No `.env` files in production; dev/prd configs in Doppler

## Major Feature Areas

### Intake Flow (`lib/intake.ts`, `lib/intake/`, `app/app/intake/`)

- Guided intake with resumable sessions
- Multi-document upload (PDF, DOCX, TXT) and text paste
- AI-powered metadata extraction and confirmation
- Duplicate detection and clustering
- Batch intake support (feature-flagged)

### Document Processing Pipeline (`lib/pipeline/`, `lib/analysis/`)

- **Inngest-only processing**: All document processing goes through Inngest background jobs — there is no local fallback
- Staged extraction: text extraction → classification → sectioning → structured term extraction → merge → risk analysis → summary
- Local parsers: `pdfjs-dist` (PDF), `mammoth` (DOCX), plain text
- Azure Document Intelligence integration (optional)
- OpenRouter LLM calls for extraction, risk analysis, and summaries
- Pipeline observability and run-state tracking
- Anonymous upload analysis (`lib/public-anonymous-analysis.ts`) is the only exception — it processes inline for unauthenticated visitors on the public landing page

### Partnership Workspaces (`lib/deals.ts`, `lib/deals/`, `app/app/p/`)

- Multi-document workspace for contracts, briefs, decks, invoices
- Editable partnership terms with evidence-backed watchouts
- Deal history table and archive
- Deliverable tracking
- Pending changes management
- Quick actions panel

### Smart Inbox (`lib/email/`, `components/inbox-workspace/`)

- Email provider integration (Gmail, Outlook, Yahoo)
- OAuth and app-password based connection
- AI-powered reply drafting and summarization
- Thread linking and candidate discovery
- Inbox sort and filter
- Action item extraction

### Billing & Subscriptions (`lib/billing/`, `app/app/billing/`)

- Three tiers: Free, Basic ($29/mo), Premium ($79/mo)
- Stripe checkout, customer portal, and webhook reconciliation
- Entitlement resolution from Prisma/Postgres
- Usage-based feature gating
- Trial support and plan switching

### AI Assistant (`lib/assistant/`, `components/assistant-*.tsx`)

- In-workspace AI assistant with tool calling
- Prompt assembly and runtime management
- Suggested prompts and snapshots
- Vercel AI SDK integration

### Invoice Management (`lib/invoices.ts`, `components/invoice/`)

- Invoice generation and editing
- PDF export via jsPDF
- Invoice reminders (feature-flagged)

## Recommended Layering

### Route / UI Layer (`app/`, `components/`)

Should only:
- Read request params or form data
- Render UI
- Call actions or domain services
- Redirect or revalidate

Should not:
- Parse complex JSON inline
- Contain extraction heuristics
- Contain repository mapping logic
- Contain business decisions

### Action Layer (`app/server-actions/`)

Should:
- Verify the viewer
- Parse and validate form input
- Call a single domain command or service
- Revalidate affected paths
- Redirect when appropriate

Should not:
- Implement extraction logic
- Implement repository translation
- Duplicate normalization logic

### Domain Layer (`lib/`)

Should:
- Define the app's business rules
- Orchestrate intake, deal, payment, and profile operations
- Convert extracted data into stable app records
- Be free of React dependencies

Should not:
- Be tied to React
- Depend on route structure
- Know about component implementation details

### Repository Layer (`lib/repository/`)

Should:
- Read and write persisted data
- Map database records to app records
- Normalize JSON fields and nullability
- Hide Prisma/file-store differences

Should not:
- Contain business logic decisions
- Decide UI behavior
- Know about route-level concerns

### Analysis Layer (`lib/analysis/`)

Should:
- Classify documents, extract structured terms, split sections
- Merge extraction results, produce risk flags and summaries
- Keep pure fallback analysis separate from LLM calls

Should not:
- Depend on React or route structure

## Development Workflows

### Getting Started

```bash
# Install Node.js 20+
# Set up Doppler: doppler setup --project hellobrand --config dev
# Populate secrets in Doppler (see .env.example for reference key list)

pnpm install
pnpm exec prisma migrate deploy
pnpm exec prisma generate
pnpm run dev
```

Open [http://localhost:3011](http://localhost:3011).

### Key Development Commands

- `pnpm run dev` - Start dev server with Doppler + Turbopack on port 3011
- `pnpm run dev:next` - Raw Next.js dev without Doppler
- `pnpm run dev:webpack` - Dev with Webpack instead of Turbopack
- `pnpm run build` - Production build
- `pnpm run build:prd` - Production build with Doppler prd config
- `pnpm run lint` - Biome lint + architecture check (`scripts/check-architecture.mjs`)
- `pnpm run format` - Biome format --write
- `pnpm run test` - Vitest unit tests
- `pnpm run test:watch` - Vitest in watch mode
- `pnpm run test:all` - Full test suite via `scripts/run-tests.sh`
- `pnpm run test:e2e` - Playwright E2E tests
- `pnpm run test:e2e:ui` - Playwright with UI
- `pnpm run test:e2e:headed` - Playwright with browser visible
- `pnpm run db:migrate` - Prisma migrations with Doppler
- `pnpm run inngest:dev` - Local Inngest dev server
- `pnpm run inngest:worker:dev` - Local Inngest worker
- `pnpm run deploy:dev` - Deploy to Fly.io dev
- `pnpm run deploy:prod` - Deploy to Fly.io production

### Type Checking

```bash
pnpm exec tsc --noEmit
```

### Linting

```bash
pnpm run lint    # Runs Biome lint + architecture check
pnpm run format  # Auto-format with Biome
```

## Code Quality & Standards

### Architecture Enforcement

`pnpm run lint` runs both Biome and `scripts/check-architecture.mjs`. The architecture check enforces:

- **File header comments** for: `app/server-actions/`, `app/api/`, `app/app/**/page-helpers.ts[x]`, `lib/intake/`, `lib/pipeline/steps/`, `lib/analysis/extract/`, `lib/analysis/llm/`, `prisma/schema/`

### Import Restrictions (Biome-enforced)

- **Components** must not import `@/lib/prisma` or `next/headers`
- **Repository modules** (`lib/repository/`) must not import `react`, `react-dom`, `next/headers`, or `next/navigation`
- **API routes and server actions** must not import from `@/components/**`

### Code Style

- **Biome** handles formatting: double quotes, trailing commas (ES5), semicolons, 2-space indent, 100-char line width
- **TypeScript strict mode** with `noEmit`, `strict: true`, `allowJs: false`
- **Tailwind CSS** with CSS variables for theming (light/dark mode via `next-themes`)
- **shadcn/ui** for UI primitives; use `components/ui/` for low-level building blocks
- **No inline styles**: use Tailwind classes or shadcn components with system props

### File Naming Conventions

| Role | Name Pattern |
| --- | --- |
| Orchestration with side effects | `service.ts` |
| Persistence reads/writes | `repository.ts` |
| Database/transport conversion | `mapper.ts` |
| One-way cleanup into stable shape | `normalizer.ts` |
| Deterministic output assembly | `builder.ts` |
| Constants and env lookups | `config.ts` |
| Shared types for one domain | `types.ts` |
| Server action entrypoints | `*-actions.ts` |
| Feature-local client hooks | `use-*.ts` |

Avoid: `helpers.ts` for large mixed modules, `utils.ts` for domain-specific behavior, `new-*`/`final-*`/`temp-*`/`v2-*` names.

### File Header Standard

Every non-trivial file should begin with a short header comment:

```ts
/**
 * This file creates billing portal sessions for authenticated viewers.
 * It handles the request boundary here and leaves Stripe reconciliation to the billing domain services.
 */
```

## Testing

### Unit Tests (Vitest)

```bash
pnpm run test              # Run all unit tests
pnpm run test:watch        # Watch mode
```

Tests live in `tests/` with the pattern `*.test.ts` or `*.test.tsx`. The Vitest config resolves `@/` aliases and runs in Node environment.

**Testing focus areas**: pure analysis helpers, intake normalization, repository mapping, route metadata, config helpers, duplicate-key/deduping behavior.

### E2E Tests (Playwright)

```bash
# Terminal 1: start E2E dev server
doppler run -- pnpm test:e2e:server

# Terminal 2: run tests
doppler run -- pnpm test:e2e
```

E2E tests use a **tier matrix** approach: one dev server, three tier projects (free/basic/premium), switched via `hb_e2e_tier` cookie.

**E2E coverage**: archive partnerships, billing, brief generation, deal workspace, delete partnership, form smoke tests, inbox, intake flow, invoices, navigation, onboarding, payments, public upload, search, settings, tier matrix, workspace nudges.

### Testing Guidelines

- **Test the seam, not everything twice**: Focus on boundaries that matter
- **Protect regressions from refactors**: When shared helpers are introduced, add tests proving they handle malformed input safely
- **Prefer real code over mocks**: Only mock external APIs, network requests, timers, and non-deterministic behavior
- **Never mock**: UI components, pure presentational components, internal selectors and utilities

## Database

### Prisma Schema

The schema is split into domain files in `prisma/schema/`:

| File | Domain |
| --- | --- |
| `base.prisma` | Base configuration and generators |
| `core.prisma` | Core app entities |
| `deals.prisma` | Partnership/deal entities |
| `documents.prisma` | Document entities |
| `intake.prisma` | Intake session entities |
| `billing.prisma` | Billing, subscriptions, trials, usage ledgers |
| `email.prisma` | Email accounts, threads, candidates |
| `ai.prisma` | AI-related entities |
| `assistant.prisma` | Assistant snapshots and state |
| `notifications.prisma` | Notification entities |
| `profile.prisma` | Profile and settings |
| `admin.prisma` | Admin tools |

### Key Rules

- Schema and migrations only in `prisma/`; no application logic
- `prisma.config.ts` points to the multi-file schema directory
- Treat Prisma/Postgres as the canonical source of durable app state
- Do not hide business rules in migration SQL

## Feature Flags

Feature flags are defined in `flags.ts` and backed by LaunchDarkly:

- `yahoo-provider-enabled`, `gmail-provider-enabled`, `outlook-provider-enabled`
- `yahoo-oauth-enabled`, `yahoo-app-password-enabled`
- `invoice-editor-enabled`
- `ai-risk-analysis-enabled`, `ai-conflict-intelligence`
- `batch-intake-enabled`, `intake-clustering-enabled`
- `smart-inbox-enabled`, `invoice-reminders-enabled`
- `sidebar-milestones-enabled`
- `blog-summarize-enabled`
- `maintenance-mode`

When LaunchDarkly is not configured, all flags fall back to their default values.

## API Surface

### Core Routes

- `POST /api/intake` — Start intake session
- `GET /api/intake/:sessionId` — Get intake session
- `POST /api/intake/:sessionId/retry` — Retry failed intake
- `POST /api/intake/:sessionId/confirm` — Confirm and create partnership
- `GET /api/p` — List partnerships
- `POST /api/p` — Create partnership
- `GET /api/p/:dealId` — Get partnership
- `PATCH /api/p/:dealId` — Update partnership
- `POST /api/p/:dealId/contract` — Upload contract (alias)
- `GET /api/p/:dealId/documents` — List documents
- `POST /api/p/:dealId/documents` — Upload document
- `POST /api/documents/:documentId/reprocess` — Reprocess document
- `GET /api/p/:dealId/report` — Get report
- `PATCH /api/p/:dealId/report` — Update report
- `GET /api/p/:dealId/drafts` — List drafts
- `POST /api/p/:dealId/drafts` — Create draft
- `GET /api/payments` — List payments
- `PATCH /api/payments` — Update payment
- `GET /api/profile` — Get profile
- `PATCH /api/profile` — Update profile

### Additional Routes

- `app/api/stripe/` — Stripe webhooks
- `app/api/assistant/` — AI assistant
- `app/api/email/` — Email sync and webhooks
- `app/api/notifications/` — Notifications
- `app/api/onboarding/` — Onboarding state
- `app/api/health/` — Health check
- `app/api/public/` — Public upload and anonymous analysis
- `app/api/admin/` — Admin tools

## Inngest Background Jobs

### Function Registry

All Inngest functions are registered in `lib/inngest/app.ts`. Function modules:

- `lib/inngest/document-functions.ts` — Document processing pipeline
- `lib/inngest/email-functions.ts` — Email sync, incremental fetch, reminders
- `lib/inngest/functions.ts` — General async functions

### Worker Deployment

- **Vercel route**: `/api/inngest` (default, disable with `INNGEST_SERVE_DISABLED=1`)
- **Fly.io worker**: Separate Fly app running `scripts/inngest-worker.ts`
- Do not run both Vercel serve and Fly worker for the same production app simultaneously

## Deployment

### Fly.io (Production)

- **Web app**: `fly.app.toml` → `Dockerfile.app`
- **Inngest worker**: `fly.toml` → `Dockerfile.inngest-worker`
- Deploy: `pnpm run deploy:prod` or `pnpm run deploy:dev`
- Both run as separate Fly apps

### Vercel (Previews)

- Preview deployments for non-`main` branches via Vercel Git integration
- Production Vercel deploys are disabled for `main` (GitHub Actions handles production deploys)

### CI/CD (GitHub Actions)

- `.github/workflows/ci.yml` — Lint, typecheck, test on PRs and main pushes
- `.github/workflows/deploy-production.yml` — Deploy to Vercel after tests pass on main
- `.github/workflows/deploy-dev.yml` — Deploy dev environment
- `.github/workflows/fly-review.yml` — Fly.io review apps

## Client State Ownership Rules

| State Type | Where | Examples |
| --- | --- | --- |
| Presentational UI state | `useState` in component | Open/closed, hover, loading indicators |
| Complex coupled transitions | `useReducer` or feature hook | Inbox thread selection, reply composition, candidate discovery |
| Shareable/navigable state | URL search params | Inbox filters, selected thread, route tabs |
| Cross-tree client-only state | Zustand (`lib/stores/`) | Intake draft/session UI state |
| Durable app state | Prisma/Postgres | Profiles, onboarding, notifications, billing, inbox threads |
| Identity/session metadata | Clerk (minimal) | Display name, small onboarding flags |

## Current Refactor Priorities

These files exceed the "easy to understand in one pass" bar and should be split when touched next:

- `lib/billing/service.ts` — Split into `checkout.ts`, `portal.ts`, `reconciliation.ts`, `webhook-events.ts`
- `app/app/page.tsx` — Extract dashboard business rules
- `components/custom-auth-screen.tsx`
- `components/notifications-center.tsx`
- `components/terms-editor.tsx`

Preferred split direction: extract pure mappers/normalizers, separate read-model composition from write commands, move repeated form logic into smaller helpers or subcomponents.

## AI Agent Guidelines

### When Working on This Codebase

1. **Layer first**: Determine correct architectural layer before making changes
2. **Keep route files thin**: Route handlers and pages orchestrate, not implement
3. **Domain logic in `lib/`**: Business rules never belong in components or route handlers
4. **UI logic in `components/`**: Rendering and interaction only
5. **Respect import restrictions**: Components must not import Prisma, repository modules must not import React
6. **Test the seams**: Add tests for shared helpers and domain boundaries you modify
7. **Run lint + typecheck**: Always run `pnpm run lint` and `pnpm exec tsc --noEmit` after changes
8. **Use shadcn/ui**: Use existing `components/ui/` primitives before building custom UI
9. **Tailwind for styling**: Use Tailwind classes, not inline styles
10. **Doppler for secrets**: Never commit `.env` files or secrets
11. **Feature flags for new features**: Gate new features behind LaunchDarkly flags in `flags.ts`
12. **File headers**: Add/update header comments for non-trivial files you create or modify

### Before Making Changes

1. Check the task router above to find the right starting point
2. Read the relevant domain modules in `lib/` to understand existing patterns
3. Check `lib/repository/` if your change involves data persistence
4. Check `flags.ts` if your change should be behind a feature flag
5. Review `components/ui/` for existing UI primitives before creating new ones

### Environment & Secrets

- All secrets managed via Doppler (`doppler setup --project hellobrand --config dev`)
- Key env vars: `DATABASE_URL`, `SUPABASE_URL`, `OPENROUTER_API_KEY`, `CLERK_SECRET_KEY`, `STRIPE_SECRET_KEY`, `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY`
- Optional: `AZURE_DOCUMENT_INTELLIGENCE_*`, `RESEND_API_KEY`, `LAUNCHDARKLY_SDK_KEY`, `SENTRY_DSN`
- Local tier override: `HELLOBRAND_DEV_PLAN=free|basic|premium`
- E2E auth: `HELLOBRAND_E2E_ENABLED=1` + `HELLOBRAND_E2E_AUTH_SECRET`

## Style Guidelines

- TypeScript strict mode: no `any` — explicitly cast or use `unknown` as intermediary
- Do not use inline `style` or `css` props; use Tailwind classes or shadcn components
- Use `server-only` package to guard server-only modules from client imports
- Prefer `@/` path aliases over relative imports
- Double quotes for strings (Biome enforced)
- 2-space indentation (Biome enforced)
- Trailing commas ES5 style (Biome enforced)

## Skills

Repeatable workflows are available as formal skills in `.agents/skills/` and `.claude/skills/`. Each skill has detailed documentation in its `SKILL.md` file.

**Available skills**: See `.agents/skills/` directory for the full list.

---

For detailed architecture documentation, see:
- [APP_STRUCTURE_AND_CLEAN_CODE.md](./APP_STRUCTURE_AND_CLEAN_CODE.md) — Full architectural guide, layering rules, and naming conventions
- [docs/architecture/repo-map.md](./docs/architecture/repo-map.md) — Onboarding-oriented repo map
- [README.md](./README.md) — Setup instructions, API surface, E2E testing, and deployment details

# Behavioral Guidelines

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.
