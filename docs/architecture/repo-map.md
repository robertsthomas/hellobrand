# HelloBrand Repo Map

This document is the shortest useful onboarding guide for the codebase.

Read this first if you are new to the repo and need to decide where code belongs before making changes.

## What This App Is

HelloBrand is a Next.js App Router application with:

- public marketing and upload surfaces
- authenticated product routes under `app/app`
- Prisma-backed durable application state
- domain-heavy flows for intake, deal workspaces, billing, documents, and email inbox workflows

The codebase is already production-grade in scope. The main structural risk is oversized files and mixed responsibilities, not a lack of folders.

## Top-Level Map

### `app/`

Use `app/` for route ownership and request boundaries.

Main areas:

- `app/app/`: signed-in product routes
- `app/api/`: HTTP route handlers
- `app/server-actions/`: authenticated mutation entrypoints
- top-level public pages such as marketing, uploads, pricing, and auth entrypoints

Put code here when it is about:

- URLs
- page composition
- metadata
- request parsing
- redirects
- revalidation

Do not put long-lived business rules here.

### `components/`

Use `components/` for rendering and client interaction.

Important subareas:

- `components/ui/`: low-level primitives
- `components/patterns/`: repeated layout and composition patterns
- feature components at the root or in feature folders
- `components/use-*.ts`: client orchestration hooks for complex UI flows

Put code here when it is about:

- JSX rendering
- local UI state
- event handling
- feature-local client state transitions

Do not put database writes, persistence mapping, or domain policy here.

### `lib/`

Use `lib/` for domain logic and integration code.

Current high-value clusters:

- `lib/analysis/`: extraction, fallback parsing, prompts, and summary logic
- `lib/assistant/`: assistant runtime, blocks, prompts, tools, and snapshots
- `lib/billing/`: plans, entitlements, rules, and Stripe coordination
- `lib/email/`: providers, inbox intelligence, AI drafting, and repository logic
- `lib/repository/`: persistence abstraction and record mapping
- `lib/stores/`: narrow client-side stores

Put code here when it is about:

- domain rules
- normalization
- orchestration
- external service adapters
- repository boundaries
- pure transforms

React components should not live here.

### `prisma/`

Use `prisma/` for schema and migration history only.

Keep application behavior out of migrations.

### `tests/`

Use `tests/` for:

- Vitest coverage of domain seams
- focused regression tests for extracted helpers
- Playwright end-to-end coverage under `tests/e2e/`

When extracting code, add tests for the seam you introduced rather than retesting the whole feature twice.

## Current High-Risk Hotspots

These files are difficult to understand in one pass and should be treated carefully when touched:

- [components/inbox-workspace.tsx](/Users/thomasroberts/Desktop/projects/hellobrand/components/inbox-workspace.tsx)
- [lib/email/service.ts](/Users/thomasroberts/Desktop/projects/hellobrand/lib/email/service.ts)
- [lib/email/repository.ts](/Users/thomasroberts/Desktop/projects/hellobrand/lib/email/repository.ts)
- [lib/repository/prisma-repository.ts](/Users/thomasroberts/Desktop/projects/hellobrand/lib/repository/prisma-repository.ts)
- [lib/intake.ts](/Users/thomasroberts/Desktop/projects/hellobrand/lib/intake.ts)
- [lib/deals.ts](/Users/thomasroberts/Desktop/projects/hellobrand/lib/deals.ts)
- [lib/types.ts](/Users/thomasroberts/Desktop/projects/hellobrand/lib/types.ts)

The default rule for these files is to extract smaller named modules instead of adding more unrelated logic in place.

## Decision Guide

Ask these questions in order:

1. Is this code primarily about a URL, request, or page?
   Put it in `app/`.
2. Is it primarily rendering or handling local interaction?
   Put it in `components/`.
3. Is it domain logic, normalization, orchestration, or integration?
   Put it in `lib/`.
4. Is it persistence translation?
   Put it in `lib/repository/`.
5. Is it schema shape or migration history?
   Put it in `prisma/`.

If the answer feels like "some of each", split the file before adding more.

## File Header Standard

Every non-trivial shared file should begin with a short ownership comment.

Example:

```ts
/**
 * Owns intake session write orchestration for authenticated viewers.
 * Keep document extraction heuristics and UI-specific state out of this module.
 */
```

The comment should describe:

- what the file owns
- what should stay out
- any important invariant

## Naming Guidance

Preferred file roles:

- `service`: orchestration and side effects
- `repository`: persistence access
- `mapper`: record conversion
- `normalizer`: shape cleanup into stable records
- `builder`: deterministic assembly
- `config`: constants and environment lookup
- `types`: one domain's shared types

Avoid vague permanent names like `helpers`, `misc`, or `temp`.

## Where To Look First By Feature

- deals and workspace changes: `lib/deals.ts`, `app/app/p/*`, related workspace components
- intake flow: `lib/intake.ts`, `lib/intake-normalization.ts`, `app/app/intake/*`, intake components
- billing: `lib/billing/*`, `app/app/billing/*`, `app/api/stripe/webhook/route.ts`
- inbox and email: `lib/email/*`, `components/inbox-*`, `components/inbox-workspace.tsx`, `app/api/email/*`
- analysis pipeline: `lib/analysis/*`, `lib/pipeline-steps.ts`, document pipeline helpers

## Working Rule

Before adding code, decide the owning layer first.

If you have to explain a file as "it kind of does several things", the file should be split.
