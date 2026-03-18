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

### `lib/`

Use `lib/` for domain logic, data access, parsing, normalization, and shared utilities.

Responsibilities:

- Deal and intake orchestration
- Analysis and extraction
- Repository adapters
- Validation helpers
- Data normalization and mapping
- Non-UI business rules

Rules:

- Pure functions belong here first.
- Keep side-effectful code separated from data transforms.
- Keep repository mapping in dedicated mapper helpers.
- Keep domain-specific logic out of UI components.

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
- `lib/repository/`: persistence adapters and mapping
- `lib/*-metadata.ts`: shared config and lookup data

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
