# In-Progress Ticket Run

Started: 2026-04-24
Workspace: `/Users/thomasroberts/Desktop/projects/hellobrand`

## Purpose

This file tracks the execution order, completion notes, verification status, and follow-up context for the current Linear `In Progress` run.

## Execution Order

1. `ROB-95` - Build analytics data collection, aggregation models, and metric pipelines
Why first:
The analytics page already exists, so the backend analytics contract needs to be stabilized before more UI work lands. This is the dependency path for `ROB-96`.

2. `ROB-96` - Implement analytics dashboards, filters, and drill-down experiences
Why second:
This depends on `ROB-95` so the UI can target a stable analytics snapshot instead of deriving metrics ad hoc in the page.

3. `ROB-181` - Document AI schema setup: define entity types, datasets, and initial trained versions for contract and brief extractors
Why third:
This is likely the gating setup for the Document AI-backed extraction work and needs to be assessed before the extraction-v2 ticket can be closed.

4. `ROB-177` - Brief and deck extraction v2: build a Document AI-backed extraction path for campaign briefs, deliverables briefs, and pitch decks
Why fourth:
This should follow the schema/setup work in `ROB-181` if that ticket is a real dependency rather than just documentation.

## Epics

`ROB-68`, `ROB-70`, and `ROB-107` are epics. They are not being treated as implementation tickets. They should only move once their remaining child scope is actually resolved or explicitly split further.

## Ticket Notes

### ROB-95

Status: Done locally, ready for review

What is being changed:
- Build a dedicated analytics service layer instead of calculating analytics inline in the page.
- Standardize the snapshot contract for metrics, monthly revenue, pipeline breakdowns, payment health, and top content.
- Keep the current analytics page UI intact and swap it to the service-backed data path.

Why:
- The current analytics page is already rendered, but its metrics are derived directly in route helpers from raw deal aggregates.
- That makes future filters, drill-downs, and data expansion harder because there is no central analytics model to extend.

Connected tickets:
- Blocks or de-risks `ROB-96`.
- Supports eventual reporting work under `ROB-70`.

Verification target:
- Unit tests for analytics aggregation logic.
- Existing analytics/tier Playwright coverage remains green.

What was done:
- Added `lib/analytics/service.ts` as the new backend analytics aggregation layer.
- Moved analytics calculation responsibility out of the route helper and into a reusable snapshot builder.
- Added support for analytics snapshot options that already cover the next UI step:
  - time range
  - brand filtering
  - status filtering
  - archived inclusion toggle
  - top content limits
- Standardized analytics outputs for:
  - metric cards
  - monthly revenue series
  - pipeline breakdown
  - payment health
  - top-value workspace ranking
  - available brands and statuses for future filters
- Updated the analytics page to load from the analytics service instead of directly reading cached deals and profile state in the route.
- Kept the existing analytics UI structure intact to avoid mixing backend and UI scope in the same ticket.

Why this approach:
- `ROB-95` is the data-contract ticket, not the UI polish ticket.
- Centralizing analytics logic behind a service gives `ROB-96` a stable backend target for filters and drill-downs.
- The page was already rendering useful analytics; the main missing piece was a proper backend model that could grow without duplicating logic across pages and helpers.

Connected work:
- Direct dependency for `ROB-96`, which can now focus on filters and drill-down behavior instead of rebuilding analytics rules inline.
- Supports `ROB-70` by establishing a reusable analytics contract that can later move to persisted snapshots or event-backed aggregation if needed.

Verification completed:
- `pnpm exec vitest run tests/analytics-service.test.ts`
- `pnpm exec playwright test tests/e2e/tier-matrix.spec.ts`

Verification results:
- Analytics unit suite passed: `3 passed`
- Tier matrix Playwright suite passed: `12 passed`
- Targeted type check for this slice is clean
- Remaining unrelated compiler issue still present: stale `.next/types/validator.ts` references missing `app/api/inngest/route.js`

Follow-up:
- `ROB-96` should consume the new analytics snapshot options for real filter controls and drill-down entry points.
- If analytics needs historical accuracy beyond current deal-derived state, the next backend step is persisted snapshots or an event ledger. That should be a deliberate extension, not mixed into the current page work.
