# HelloBrand App Structure and Clean Code Guide

This document defines how the app should be organized, how logic should be separated, and what "clean code" means for this repo.

The goal is not just style. The goal is to make the codebase easy to read, easy to test, and hard to break as the app grows.

## Phase 0 Baseline

This guide is the architectural baseline for the cleanup plan.

What Phase 0 establishes:

- one written source of truth for module ownership
- a short onboarding map for new developers
- a standard top-of-file header comment convention
- naming rules for common file roles
- a default path for future refactors so cleanup work stays consistent

This document is intentionally prescriptive. If a new change conflicts with it, either follow the guide or update the guide in the same change.

## Principles

1. Keep files small enough to understand in one pass.
2. Separate orchestration from pure logic.
3. Keep UI components focused on rendering and interaction.
4. Keep server code focused on auth, validation, persistence, and redirects.
5. Keep domain rules in `lib/`, not inside route handlers or components.
6. Prefer explicit data flow over hidden side effects.
7. Prefer shared helpers over copied logic.
8. Prefer stable, typed boundaries over ad hoc JSON shape handling.
9. Give every piece of state one clear owner.

## Quick Placement Guide

When adding or moving code, use this table first.

| If the code is primarily... | Put it in... | Notes |
| --- | --- | --- |
| route entry, metadata, layout, redirect, or composition | `app/` | keep route files thin |
| authenticated mutation entrypoint | `app/server-actions/` | validate input, call one domain path |
| reusable rendering or client interaction | `components/` | avoid business rules here |
| feature-local client orchestration | `components/use-*.ts` or feature-local hook files | prefer local ownership over global state |
| domain rules, orchestration, normalization, or transforms | `lib/` | React should not live here |
| persistence adapters or database mapping | `lib/repository/` | hide Prisma/file-store details |
| document extraction, prompt building, and result merging | `lib/analysis/` | split fallback, prompts, and merging logic |
| schema definition or migrations | `prisma/` | no application logic here |

If a file fits multiple rows, it is usually too large or doing too much.

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
  - `app/deals/[dealId]/page.tsx` re-exporting from `app/app/p/[dealId]/page.tsx`
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
- If a component owns several related state transitions, extract a feature hook or move to `useReducer` before reaching for global state.
- Shared, cross-tree browser state should be rare and explicit.
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
- Client-to-server draft mappers and normalization helpers for forms

Rules:

- Pure functions belong here first.
- Keep side-effectful code separated from data transforms.
- Keep repository mapping in dedicated mapper helpers.
- Keep domain-specific logic out of UI components.
- Treat Prisma/Postgres as the canonical source of durable app state unless there is a strong reason not to.
- Keep Clerk metadata minimal and convenience-oriented.
- Use Supabase for storage or infrastructure capabilities, not as a second canonical app-state database.

### `prisma/`

Use `prisma/` for schema and migration history only.

Responsibilities:

- Prisma schema definition
- Forward-only migration files

Rules:

- Do not hide business rules in migration SQL.
- Application logic should not depend on ad hoc SQL in route handlers.
- If a manual migration is applied outside Prisma, resolve the migration history explicitly.

## Repo Map

This is the shortest useful description of the current repo shape.

- `app/`
  - Next.js route tree
  - `app/api/` for HTTP route handlers
  - `app/server-actions/` for authenticated mutation entrypoints
  - `app/app/` for signed-in product routes
- `components/`
  - shared UI components
  - feature components
  - `components/ui/` for low-level primitives
  - `components/patterns/` for repeated screen-level composition patterns
  - `components/inbox-workspace/` for inbox subcomponents, formatters, and helpers
- `lib/`
  - domain logic and integration code
  - current domain clusters include `analysis`, `assistant`, `billing`, `email`, `repository`, `stores`
  - `lib/email/` is further split into focused modules: `repository/`, `service-shared`, `service-sync`, `service-connect`, `service-ai`
- `prisma/`
  - schema and migration history
- `tests/`
  - Vitest coverage for domain seams and Playwright E2E coverage under `tests/e2e/`
- `docs/`
  - durable project docs, rollout notes, and architecture references

The preferred future direction is:

- fewer catch-all files at the root of `lib/`
- fewer catch-all files at the root of `components/`
- more feature-local folders once a feature has multiple moving parts
- stable barrels only when they reduce churn without hiding ownership

See [docs/architecture/repo-map.md](/Users/thomasroberts/Desktop/projects/hellobrand/docs/architecture/repo-map.md) for the onboarding version of this map.

## Current Repo-Specific Boundaries

These boundaries reflect the repo as it exists today and should be treated as the active convention.

- `app/server-actions/`: authenticated action entrypoints grouped by surface
- `lib/deals.ts`, `lib/intake.ts`, `lib/payments.ts`, `lib/profile.ts`: thin barrels over domain submodules
- `lib/deals/`: deal domain modules — `service` (CRUD + summaries), `documents` (pipeline + uploads), `terms`, `drafts`, `pending-changes`, `shared` (internal helpers)
- `lib/intake/`: intake domain modules — `index` (session lifecycle, drafts, batch), `normalization/` (evidence cleaning and record normalization)
- `lib/intake-normalization.ts`: thin barrel over `lib/intake/normalization/`
- `lib/analysis/`: extraction, fallback parsing, LLM orchestration, and summary generation
- `lib/email/`: provider-agnostic email domain logic, AI helpers, repository helpers, and smart inbox behavior
  - `lib/email/service.ts`: thin entry point re-exporting viewer-facing inbox actions
  - `lib/email/service-sync.ts`: email sync and incremental fetch logic
  - `lib/email/service-connect.ts`: OAuth and webhook handling
  - `lib/email/service-ai.ts`: AI drafting and summarization
  - `lib/email/service-shared.ts`: shared email workflow helpers
  - `lib/email/repository/`: Prisma mapping grouped by domain (`shared`, `accounts`, `threads`, `candidates`)
- `lib/billing/`: plan catalog metadata, entitlement resolution, Stripe config helpers, checkout and portal orchestration, and webhook reconciliation
- `lib/assistant/`: prompt assembly, runtime, tool wiring, snapshot generation, and UI block definitions
- `lib/repository/`: persistence abstraction for Prisma-backed and file-backed modes
- `lib/cached-data.ts`: route-facing cached loaders for read-heavy pages
- `lib/browser/` and `lib/stores/`: browser-only queue/state helpers
- `components/ui/`: primitive UI building blocks
- `components/figma/`: Figma-specific rendering or integration helpers
- `components/use-*.ts`: feature-local client orchestration hooks for complex UI flows
- `components/inbox-workspace/`: inbox UI subcomponents
  - `InboxThreadList.tsx`: left panel thread list
  - `InboxThreadDetail.tsx`: right panel conversation view
  - `InboxReplyComposer.tsx`: reply composer with AI drafting controls
  - `InboxMessageView.tsx`: email message rendering, attachment shelf, and preview
  - `formatters.ts`: pure display formatting (no React, no hooks)
  - `helpers.ts`: business logic helpers, types, and constants (no React, no hooks)
- `components/inbox-workspace.tsx`: composition-only orchestrator that owns state/effects and delegates rendering to `inbox-workspace/` subcomponents
- `lib/*-draft.ts` and `lib/*-profile.ts`: shared normalization and payload-shaping helpers

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

## Naming Rules

Use file names to describe the job, not the implementation detail.

Preferred names:

- `service`: orchestration with side effects and domain decisions
- `repository`: persistence reads and writes behind a stable interface
- `mapper`: database or transport record conversion only
- `normalizer`: one-way cleanup into a stable internal shape
- `builder`: deterministic output assembly from existing inputs
- `config`: constants and environment lookups
- `types`: shared types for one domain, not the whole app
- `actions`: server action entrypoints only
- `route`: HTTP boundary only

Avoid:

- `helpers` for large mixed modules
- `utils` for domain-specific behavior that deserves a real name
- `new-*`, `final-*`, `temp-*`, or `v2-*` as long-lived file names unless the rollout itself is the domain

When a feature outgrows one file, prefer a folder with explicit names over numbered or vaguely named files.

Good:

- `lib/email/threads/service.ts`
- `lib/email/threads/repository.ts`
- `lib/email/threads/mapper.ts`

Bad:

- `lib/email/helpers.ts`
- `lib/email/misc.ts`
- `lib/email/final-service.ts`

## File Header Standard

Every non-trivial file in `app/`, `components/`, `lib/`, and `prisma/` should begin with a short header comment written in plain language.

The point of the header is that a new developer can open the file and quickly understand:

1. what this file does
2. what other code it connects to or delegates to
3. what kind of logic should live somewhere else

Preferred format:

```ts
/**
 * This file creates billing portal sessions for authenticated viewers.
 * It handles the request boundary here and leaves Stripe reconciliation and entitlement writes to the billing domain services.
 */
```

For React components:

```tsx
/**
 * This file renders the workspace invoice editor.
 * It manages the local UI here and relies on `lib/invoices` for numbering, reminders, and persistence.
 */
```

For route handlers:

```ts
/**
 * This route handles intake draft mutations.
 * It accepts the HTTP request here and then calls `lib/intake` for the actual intake workflow.
 */
```

Rules:

- Keep headers short, usually one or two sentences
- Prefer natural wording like "This file..." or "This route..."
- Do not narrate obvious syntax
- Do not repeat TypeScript signatures in prose
- Add or update the header when the file responsibility changes
- Prioritize headers for files over roughly 150 lines, shared modules, route handlers, and server actions

Not every tiny leaf file needs a header immediately, but all hotspot files and all newly split files should have one.

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

## Client State Ownership Rules

State should live in the narrowest layer that can own it correctly.

### Keep local component state when the data is purely presentational

Use local `useState` for:

- open/closed UI controls
- hover, focus, popover, and tooltip visibility
- one-off text input that is not shared
- local loading indicators

### Move to `useReducer` or a feature hook when transitions are coupled

If a feature has:

- multiple fields that reset together
- optimistic UI plus request lifecycle
- step transitions
- derived flags that depend on the same underlying state

then keep it local, but pull it into a dedicated hook or reducer.

Current repo examples:

- `components/use-inbox-thread-selection.ts`
- `components/use-inbox-reply-composer.ts`
- `components/use-inbox-candidate-discovery.ts`
- `components/use-inbox-thread-detail-state.ts`
- `components/onboarding/profile-onboarding-modal.tsx` using a reducer-backed flow

### Use URL state for shareable and navigable UI state

If state should survive refreshes, support links, or be navigable with browser history, prefer URL search params over in-memory stores.

Current examples:

- inbox filters
- selected inbox thread
- route-level tabs and filters

### Use Zustand only for cross-tree, client-only state

Zustand is appropriate when all of these are true:

- the state is needed by multiple distant client components
- it is not the canonical server record
- it does not naturally belong in the URL
- it is still useful before or between saves

Good fit in this repo:

- intake draft/session UI state in `lib/stores/`

Poor fit in this repo:

- inbox thread details
- profile records
- onboarding completion state
- notification records
- billing entitlements

### Put durable app state in Prisma/Postgres

Use the database as the source of truth for:

- profiles and settings
- onboarding completion
- notifications
- linked inbox threads
- billing and entitlement state

### Keep Clerk metadata tiny

Clerk is identity and session-adjacent metadata, not the main profile store.

Good Clerk metadata candidates:

- display name
- small onboarding flags
- other tiny identity conveniences needed in session claims

Do not treat Clerk metadata as the durable home for:

- full profile settings
- notification preferences
- tax, payout, or billing data
- large mirrored JSON blobs

### Keep Supabase in its infrastructure role

In this repo, Supabase is currently best treated as:

- file storage
- supporting infrastructure
- possible future realtime transport if we intentionally add that need

It should not become a second source of truth for ordinary product state without an explicit architectural reason.

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
- `components/use-*.ts`: complex client-side feature orchestration only
- `lib/analysis/`: extraction, scoring, merging, summary logic
- `lib/deals.ts` and `lib/intake.ts`: domain orchestration
- `lib/email/`: inbox linking, email AI, and email-domain coordination
- `lib/billing/`: billing-domain coordination, Stripe adapters, and entitlement snapshot logic
- `lib/assistant/`: assistant prompt/runtime/tool layers
- `lib/repository/`: persistence adapters and mapping
- `lib/cached-data.ts`: cached read-model composition for pages
- `lib/*-draft.ts`: shared form normalization and request payload builders
- `prisma/`: schema and migrations only
- `lib/*-metadata.ts`: shared config and lookup data

## Onboarding Rules

The repo should be understandable to a new developer within their first week.

To support that goal:

- the first question should be "what layer owns this?" before "where can I squeeze this in?"
- each hot path should have one obvious entry module
- comments should describe ownership and invariants, not implementation trivia
- docs should point to stable folders, not one-off temporary files
- file moves should preserve discoverability through thin barrels until imports are migrated deliberately

If a new developer cannot quickly answer these questions, the structure still needs work:

- Where does write logic for this feature live?
- Where does read-model composition live?
- Where do I change the data shape safely?
- Which tests protect this area?

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
- Supabase is not part of the billing state model.

### Billing layer map

- `app/app/billing/page.tsx`: route composition and billing UI only
- `app/server-actions/account-actions.ts`: authenticated entrypoints for checkout and portal redirects
- `app/api/stripe/webhook/route.ts`: webhook boundary only, with signature verification and delegation into billing-domain reconciliation
- `lib/billing/config.ts`: environment and Stripe config lookups only
- `lib/billing/entitlements.ts`: effective tier resolution, feature gating, and usage-limit tracking only
- `lib/billing/plans.ts`: pricing matrix, plan metadata, and billing page view-model helpers
- `lib/billing/service.ts`: billing-account orchestration, checkout creation, portal session creation, trial enforcement, and Stripe reconciliation
- `prisma/schema/`: billing entities, trial ledgers, usage ledgers, and webhook event persistence, grouped into domain schema files
- `prisma.config.ts`: tells Prisma to load the schema from the `prisma/schema` folder and keep migrations in `prisma/migrations`

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

- `lib/billing/service.ts`
- `app/app/page.tsx`
- `components/custom-auth-screen.tsx`
- `components/notifications-center.tsx`
- `components/terms-editor.tsx`

For these files, the default expectation is:

- extract pure mappers and normalization helpers
- separate read-model composition from write commands
- move repeated form section logic into smaller helpers or subcomponents
- keep route pages focused on composition instead of accumulating dashboard business rules

Recent examples of the preferred direction in this repo:

- email service split: `lib/email/service.ts` became a thin entry point over `service-sync`, `service-connect`, `service-ai`, and `service-shared` modules
- email repository split: `lib/email/repository.ts` broke into `repository/shared`, `repository/accounts`, `repository/threads`, and `repository/candidates`
- inbox UI split: `components/inbox-workspace.tsx` became a composition-only orchestrator delegating to `components/inbox-workspace/` subcomponents (`InboxThreadList`, `InboxThreadDetail`, `InboxReplyComposer`, `InboxMessageView`) with pure helpers extracted to `formatters.ts` and `helpers.ts`
- deals domain split: `lib/deals.ts` became a thin barrel over `lib/deals/service`, `documents`, `terms`, `drafts`, `pending-changes`, and `shared`
- pipeline split: `lib/pipeline-steps.ts` (1259 lines) became a thin barrel over `lib/pipeline/run-state` (run lifecycle, step executor), `lib/pipeline/artifacts` (artifact persistence, evidence resolution), and `lib/pipeline/steps/` (7 individual pipeline step implementations)
- analysis LLM split: `lib/analysis/llm.ts` (1499 lines) reduced to ~691 lines of core infrastructure (schemas, routing, model selection, `requestStructured`, orchestration functions), with prompt construction extracted to `lib/analysis/prompts.ts` and response normalization extracted to `lib/analysis/normalizers.ts`
- analysis fallback split: `lib/analysis/fallback.ts` (1455 lines) became a thin barrel over `lib/analysis/extract/` (heuristic classification, sectioning, text parsing, field extraction, merging), `lib/analysis/risks/` (heuristic risk analysis), and `lib/analysis/summary/` (summary building, brief data extraction, document-level analysis orchestration)
- inbox state was split out of `components/inbox-workspace.tsx` into feature hooks for thread selection, reply composition, candidate discovery, and thread-detail state
- profile and settings payload shaping moved into `lib/profile-draft.ts`
- onboarding normalization moved into `lib/onboarding-draft.ts`
- Clerk profile sync was reduced to a minimal mirrored projection instead of broad metadata duplication

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

## Phase 0 Exit Criteria

Phase 0 is complete when:

- this guide is the source of truth for structure and ownership
- the repo has a short onboarding map in `docs/architecture/`
- new refactor work can use a consistent header comment convention
- future phases can reduce file size and improve modularity without debating the target layout each time

## Short Version

If a piece of logic is:

- reusable, pure, or domain-specific, put it in `lib/`
- visual or interactive, put it in `components/`
- route-specific or request-specific, put it in `app/`
- shared across multiple surfaces, centralize it once

If a file is getting harder to scan, split it before it becomes a maintenance cost.
