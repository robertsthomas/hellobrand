# HelloBrand App Structure and Clean Code Guide

This document defines how the app should be organized, how logic should be separated, and what "clean code" means for this repo.

The goal is not just style. The goal is to make the codebase easy to read, easy to test, and hard to break as the app grows.

## Principles

1. Keep files small enough to understand in one pass.
2. Separate orchestration from pure logic.
3. Keep UI components focused on rendering and interaction.
4. Keep server code focused on auth, validation, persistence, and redirects.
5. Keep domain rules in `lib/`, not inside route handlers or components.
6. Prefer explicit data flow over hidden side effects.
7. Prefer shared helpers over copied logic.
8. Prefer stable, typed boundaries over ad hoc JSON shape handling.

## High-Level App Structure

### `app/`

Use `app/` for Next.js route entrypoints, server actions, and route-level composition.

Responsibilities:

- Route files and page composition
- Server action entrypoints
- Route-specific metadata
- Thin glue between UI and domain services

Rules:

- Pages should orchestrate data loading and component composition only.
- Server actions should validate input, call domain services, then revalidate or redirect.
- Route files should not contain large chunks of business logic.
- Route aliases are acceptable when they preserve stable URLs while the real page lives elsewhere.
  Current examples:
  - `app/deals/[dealId]/page.tsx` re-exporting from `app/app/deals/[dealId]/page.tsx`
  - `app/deals/new/page.tsx` re-exporting or redirecting into the intake flow
  - `app/app/dashboard/page.tsx` re-exporting from `app/app/page.tsx`

### `components/`

Use `components/` for reusable UI pieces.

Responsibilities:

- Shared layout components
- Form sections and editor widgets
- Buttons, dialogs, tables, banners, and shell UI
- Small presentational helpers

Rules:

- Components should stay focused on rendering and UI state.
- Shared behavior should move into helper modules or hooks.
- Large form editors should be split into smaller subcomponents when they start carrying business rules.
- `components/ui/` should remain the home for low-level UI primitives.
- Route-specific composition components are acceptable here if they are still UI-first and do not own domain rules.

### `lib/`

Use `lib/` for domain logic, data access, parsing, normalization, and shared utilities.

Responsibilities:

- Deal and intake orchestration
- Analysis and extraction
- Repository adapters
- Validation helpers
- Data normalization and mapping
- Non-UI business rules
- Assistant runtime, prompt, and snapshot logic
- Email sync, linking, AI drafting, and inbox intelligence
- Billing plan metadata, Stripe checkout orchestration, portal flows, and webhook reconciliation
- Cached read models that sit between routes and domain services
- External-service adapters such as Prisma, Supabase, and Inngest

Rules:

- Pure functions belong here first.
- Keep side-effectful code separated from data transforms.
- Keep repository mapping in dedicated mapper helpers.
- Keep domain-specific logic out of UI components.

### `prisma/`

Use `prisma/` for schema and migration history only.

Responsibilities:

- Prisma schema definition
- Forward-only migration files

Rules:

- Do not hide business rules in migration SQL.
- Application logic should not depend on ad hoc SQL in route handlers.
- If a manual migration is applied outside Prisma, resolve the migration history explicitly.

## Current Repo-Specific Boundaries

These boundaries reflect the repo as it exists today and should be treated as the active convention.

- `app/server-actions/`: authenticated action entrypoints grouped by surface
- `lib/deals.ts`, `lib/intake.ts`, `lib/payments.ts`, `lib/profile.ts`: primary domain commands and orchestration
- `lib/analysis/`: extraction, fallback parsing, LLM orchestration, and summary generation
- `lib/email/`: provider-agnostic email domain logic, AI helpers, repository helpers, and smart inbox behavior
- `lib/billing/`: plan catalog metadata, entitlement resolution, Stripe config helpers, checkout and portal orchestration, and webhook reconciliation
- `lib/assistant/`: prompt assembly, runtime, tool wiring, snapshot generation, and UI block definitions
- `lib/repository/`: persistence abstraction for Prisma-backed and file-backed modes
- `lib/cached-data.ts`: route-facing cached loaders for read-heavy pages
- `lib/browser/` and `lib/stores/`: browser-only queue/state helpers
- `components/ui/`: primitive UI building blocks
- `components/figma/`: Figma-specific rendering or integration helpers

## Recommended Layering

### 1. Route / UI Layer

This layer should only:

- Read request params or form data
- Render UI
- Call actions or domain services
- Redirect or revalidate when needed

It should not:

- Parse complex JSON blobs inline
- Contain extraction heuristics
- Contain repository mapping logic
- Contain large domain decisions

### 2. Action Layer

Server actions should:

- Verify the viewer
- Parse and validate form input
- Call a single domain command or service
- Revalidate affected paths
- Redirect when appropriate

Server actions should not:

- Implement extraction logic
- Implement repository translation
- Duplicate normalization logic

### 3. Domain Layer

Domain modules should:

- Define the app's business rules
- Orchestrate intake, deal, payment, and profile operations
- Convert extracted data into stable app records
- Determine what should be merged, preserved, or flagged

Domain modules should not:

- Be tied to React
- Depend on route structure
- Know about component implementation details

### 4. Repository Layer

Repository modules should:

- Read and write persisted data
- Map database records to app records
- Normalize JSON fields and nullability
- Hide Prisma/file-store differences from the rest of the app

Repository modules should not:

- Contain business logic decisions
- Decide UI behavior
- Know about route-level concerns

### 5. Analysis Layer

Analysis modules should:

- Classify documents
- Extract structured terms
- Split sections
- Merge extraction results
- Produce risk flags and summaries

Rules:

- Keep pure fallback analysis separate from LLM calls.
- Keep prompt construction separate from parsing and merging.
- Keep confidence scoring and conflict detection explicit.

## File Organization Rules

### Prefer one responsibility per file

If a file name cannot describe its purpose in one short phrase, it is probably doing too much.

Good examples:

- `deal-actions.ts`
- `intake-actions.ts`
- `app-shell.ts`
- `row-identity.ts`
- `social-platform-icon.tsx`

Bad signs:

- A file that handles validation, persistence, rendering, and analytics
- A file that contains many unrelated helper groups

### Prefer helper modules over repeated inline logic

If a pattern appears in two places, extract it.

Examples:

- FormData parsing
- Nullable string/number/boolean helpers
- Row ID generation and deduping
- Route metadata lookup
- Platform icon lookup
- Prisma JSON mapping

### Keep barrels thin

If a file exists only to export other modules, that is acceptable only when it makes the public surface clearer.

Examples:

- `app/actions.ts` can remain a barrel if the real logic lives elsewhere.
- Re-exporting is fine when it reduces churn for import sites.

## UI Rules

### Components should be predictable

Each component should answer one question:

- What does it render?
- What interaction does it manage?
- What data shape does it accept?

If a component begins to answer several questions, split it.

### Shared UI patterns should be centralized

If multiple screens need the same:

- Social icon rendering
- Row editing patterns
- Empty states
- Shell navigation
- Route labels

then they should come from one shared source of truth.

### Keep styling consistent but not repetitive

Prefer:

- Shared class constants
- Shared UI primitives
- Shared content configs

Avoid:

- Repeating the same button, badge, or row layout logic in multiple files
- Copying long JSX blocks with tiny edits

## Data and Validation Rules

### Validate at the boundary

Validate as early as possible:

- `FormData` in server actions
- JSON input in route handlers
- Database payloads in repository adapters

### Normalize once

Do not normalize the same value in multiple layers.

Examples:

- Trim nullable strings once in the action helper layer
- Normalize row IDs before render
- Normalize Prisma JSON at repository boundaries
- Normalize deal categories at the domain boundary

### Prefer typed records over raw JSON

The app should move toward stable internal records rather than passing loose JSON through many layers.

## Testing Rules

### Test the seam, not everything twice

Focus tests on the boundaries that matter:

- Pure analysis helpers
- Intake normalization
- Repository mapping
- Route metadata and config helpers
- Duplicate-key / deduping behavior

### Protect regressions from refactors

Whenever a shared helper is introduced, add a test that proves:

- It handles duplicate or malformed input safely
- It preserves existing behavior
- It returns predictable output

## What To Avoid

- Putting business logic directly in React components
- Keeping large, mixed-responsibility files
- Duplicating parse/trim/normalize logic across actions
- Building repository payloads inline in route handlers
- Mixing pure transforms with IO in the same function
- Leaving prototype or dead code inside the active app surface

## Suggested Ownership Boundaries

- `app/`: route-level orchestration only
- `components/`: rendering and interaction only
- `lib/analysis/`: extraction, scoring, merging, summary logic
- `lib/deals.ts` and `lib/intake.ts`: domain orchestration
- `lib/email/`: inbox linking, email AI, and email-domain coordination
- `lib/billing/`: billing-domain coordination, Stripe adapters, and entitlement snapshot logic
- `lib/assistant/`: assistant prompt/runtime/tool layers
- `lib/repository/`: persistence adapters and mapping
- `lib/cached-data.ts`: cached read-model composition for pages
- `prisma/`: schema and migrations only
- `lib/*-metadata.ts`: shared config and lookup data

## Accepted Exceptions

Some current patterns are acceptable even though they are not the end-state ideal.

- Re-export route files that preserve stable URLs while app pages move
- A thin `app/actions.ts` barrel that stabilizes import paths for server actions
- A repository selector in `lib/repository/index.ts` that swaps Prisma and file-backed persistence based on environment
- Cached page loaders in `lib/cached-data.ts` that compose repository reads for the route layer

These should stay thin. If they start absorbing business logic, split them immediately.

## Billing Flow Structure

Billing is now a first-class domain slice and should follow these boundaries.

### Source of truth

- Subscription tier, trial state, and entitlement snapshots live in Prisma/Postgres.
- Clerk remains identity/auth, not the billing source of truth.
- Stripe is the external billing system of record for checkout, subscriptions, invoices, and the customer portal.
- Clerk metadata may mirror billing state later, but only as a read-only convenience layer.

### Billing layer map

- `app/app/billing/page.tsx`: route composition and billing UI only
- `app/server-actions/account-actions.ts`: authenticated entrypoints for checkout and portal redirects
- `app/api/stripe/webhook/route.ts`: webhook boundary only, with signature verification and delegation into billing-domain reconciliation
- `lib/billing/config.ts`: environment and Stripe config lookups only
- `lib/billing/entitlements.ts`: effective tier resolution, feature gating, and usage-limit tracking only
- `lib/billing/plans.ts`: pricing matrix, plan metadata, and billing page view-model helpers
- `lib/billing/service.ts`: billing-account orchestration, checkout creation, portal session creation, trial enforcement, and Stripe reconciliation
- `prisma/schema.prisma`: billing entities, trial ledgers, usage ledgers, and webhook event persistence

### Billing rules

- Pricing copy and feature matrices should not live inline in route files.
- Trial eligibility rules should live in billing-domain helpers, not in components.
- Entitlement checks should run in domain services or route boundaries before expensive work starts.
- Usage ledgers should be written centrally from billing-domain helpers, not ad hoc from components.
- Stripe webhook routes should not implement business decisions inline beyond event routing and failure handling.
- Billing page components should render the current entitlement snapshot and submit actions, not inspect raw Stripe payloads.
- Idempotency for webhook events must be persisted in the database, not handled only in memory.
- Active subscription changes should use Stripe-managed flows such as the customer portal unless there is a clear app-owned need to diverge.

### Billing clean-code expectations

- Keep plan catalog data separate from subscription lifecycle code.
- Keep Stripe payload parsing helpers separate from UI-facing billing copy.
- Prefer one place for trial-duration rules and one place for plan-availability rules.
- Prefer one place for feature flags and one place for usage-limit enforcement.
- Keep webhook reconciliation resilient to event ordering; `checkout.session.completed` cannot be assumed to arrive before `customer.subscription.*`.
- When the billing service grows, split by responsibility:
  - `plans`
  - `checkout`
  - `portal`
  - `reconciliation`
  - `webhook-events`

## Current Refactor Priorities

The following files are beyond the "easy to understand in one pass" bar and should be treated as refactor targets when touched next:

- `lib/deals.ts`
- `lib/intake.ts`
- `lib/email/service.ts`
- `lib/billing/service.ts`
- `lib/analysis/llm.ts`
- `app/app/page.tsx`
- `components/profile-editor.tsx`
- `components/terms-editor.tsx`

For these files, the default expectation is:

- extract pure mappers and normalization helpers
- separate read-model composition from write commands
- move repeated form section logic into smaller helpers or subcomponents
- keep route pages focused on composition instead of accumulating dashboard business rules

For `lib/billing/service.ts` specifically, the next split should move toward:

- `lib/billing/checkout.ts` for checkout-session creation and trial-offer selection
- `lib/billing/portal.ts` for Stripe billing-portal session creation
- `lib/billing/reconciliation.ts` for subscription and invoice reconciliation
- `lib/billing/webhook-events.ts` for durable event processing state and idempotency

## Clean Code Checklist

Before merging a change, check:

- Can I describe the file in one sentence?
- Is the logic in the right layer?
- Am I duplicating normalization or parsing?
- Is the public API smaller than the implementation?
- Did I add or update tests for the seam I touched?
- Would a new developer know where to put the next related change?

## Short Version

If a piece of logic is:

- reusable, pure, or domain-specific, put it in `lib/`
- visual or interactive, put it in `components/`
- route-specific or request-specific, put it in `app/`
- shared across multiple surfaces, centralize it once

If a file is getting harder to scan, split it before it becomes a maintenance cost.
