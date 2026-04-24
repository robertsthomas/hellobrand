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

Execution note:
After codebase review, `ROB-177` was completed before `ROB-181` because the repo already had a distinct brief/deck extraction path plus fallback heuristics that could be improved and verified locally. `ROB-181` has now been canceled because the team is not using Google Cloud Document AI and any remaining vendor-specific Document AI code/config has been removed from the repo.

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

### ROB-96

Status: Done locally, ready for review

What is being changed:
- Add real filter controls to the analytics page.
- Expose drill-down entry points from analytics into underlying workspace and payment surfaces.
- Surface a visible pipeline breakdown so the page is more useful than a static metric summary.

Why:
- `ROB-95` created the analytics snapshot contract, but the page was still mostly a fixed presentation layer.
- `ROB-96` is where the analytics page becomes navigable and usable: range control, brand/status filters, and links into the underlying records.

What was done:
- Updated `app/app/analytics/page.tsx` to accept `searchParams` and apply:
  - range selection
  - brand filtering
  - status filtering
- Added range links for:
  - 30 days
  - 90 days
  - 6 months
  - 12 months
  - all time
- Added select-based filters for brand and status with a reset path.
- Added explicit drill-down links to:
  - workspace history
  - payments
  - individual workspace detail pages from the top-content list
- Added a pipeline breakdown panel in the right rail using the analytics snapshot produced by `ROB-95`.
- Kept the page structure and styling aligned with the existing analytics surface instead of redesigning the route.

Connected work:
- Depends directly on `ROB-95`.
- Advances `ROB-70` by making the analytics page meaningfully navigable.

Verification completed:
- `pnpm exec playwright test tests/e2e/analytics.spec.ts tests/e2e/tier-matrix.spec.ts`
- `pnpm exec vitest run tests/analytics-service.test.ts`

Verification results:
- Analytics/tier Playwright coverage passed: `18 passed`
- Analytics service unit coverage remained green: `3 passed`
- Targeted type check for the changed analytics page is clean
- Remaining unrelated compiler issue still present: stale `.next/types/validator.ts` references missing `app/api/inngest/route.js`

Follow-up:
- The current drill-down links route into existing history/payments/workspace surfaces. If finer-grained filtered drill-down is needed, the next step is to make the destination pages consume compatible query params.
- If advanced reporting under Premium needs additional sections, it can now build on the same snapshot/filter plumbing rather than adding page-local calculations.

### ROB-177

Status: Done locally, ready for review

What is being changed:
- Strengthen the brief/deck extraction path so campaign guidance documents are handled as brief inputs rather than weak contract-like fallbacks.
- Expand the fields captured from loosely structured deliverables briefs and pitch decks.
- Keep the extraction changes inside the existing analysis/pipeline layers without changing any UI.

Why:
- The existing brief extraction handled only the most basic overview and messaging fields.
- Real creator briefs and pitch decks often include operational guidance such as approval timing, revisions, required claims, links/assets, posting windows, and reporting expectations.
- `ROB-177` explicitly requires clear fallback behavior for weakly structured creative materials, and that is something the current repo can improve and verify locally without depending on any external Document AI vendor setup.

What was done:
- Expanded `extractBriefData()` in `lib/analysis/summary/index.ts` to capture:
  - deliverables summary
  - revision requirements
  - required claims
  - disclosure requirements
  - competitor restrictions
  - links and assets
  - posting schedule
  - campaign live date
  - draft due date
  - content due date
  - payment schedule, requirements, and notes
  - reporting requirements
  - creator handle
  - detected delivery platforms
- Tightened deliverables section matching so a heading like `Deliverables Brief` is no longer misread as the actual deliverables body.
- Updated brief brand inference in `lib/analysis/extract/brief.ts` so generic headings like `Pitch Deck` and `Deliverables Brief` are skipped instead of being treated as brand names.
- Added focused unit coverage for:
  - richer deliverables-brief extraction
  - weakly structured pitch deck extraction
- Verified that the pipeline extraction step still passes against the shared extractor.

Why this approach:
- The extraction heuristics in `lib/analysis/summary/index.ts` are used by both fallback analysis and the document pipeline heuristics path.
- Improving that shared extraction layer advances `ROB-177` in a way that is immediately testable and directly useful in the app.
- This keeps legal-field extraction separate from brief guidance extraction, which is part of the ticket’s acceptance criteria.

Connected work:
- Supports `ROB-169` by improving workspace-safe brief enrichment.
- De-risks future vendor-backed extraction because the normalization targets are now clearer even when vendor output is weak or missing.
- Leaves `ROB-181` as the external processor/schema setup follow-up rather than mixing cloud setup into heuristic extraction work.

Verification completed:
- `pnpm exec vitest run tests/brief-fallback-analysis.test.ts tests/extract-fields-step.test.ts`

Verification results:
- Brief fallback and extraction-step coverage passed: `8 passed`
- Targeted type check for changed files is clean
- Remaining unrelated compiler issue still present: stale `.next/types/validator.ts` references missing `app/api/inngest/route.js`

Follow-up:
- If richer brief review UX is needed later, it can build on these extracted fields without revisiting the parsing layer first.

### ROB-181

Status: Canceled

What was assessed:
- Checked the current repo for Google Document AI processor integration, verification scripts, and extractor schema documentation.
- Checked local env key names and Doppler secret names only, without reading secret values.

Findings:
- The acceptance criteria in `ROB-181` reference `scripts/verify-document-ai-contract.ts` and `scripts/verify-document-ai-brief.ts`, but those files are not present in this repo.
- At the time of assessment, the checked-in document text extraction path used an optional Azure-based OCR/layout integration rather than Google Document AI custom extractors.
- `.env.example`, `.env.local` key names, and Doppler secret names do not include Google Document AI processor identifiers or service-account style configuration needed to run the described verification flow.
- No checked-in documentation currently maps the Google Cloud entity names in the ticket to a live processor configuration.

What was done:
- Canceled `ROB-181` because the team is not using Google Cloud Document AI.
- Removed the optional vendor-specific OCR/document-intelligence code path from the repo so document text extraction now relies on the existing local parsers only.
- Removed the vendor-specific tests and public config/docs references tied to that code path.

What needs to happen next:
- If a future hosted document extraction vendor is introduced, it should come back as a new ticket with an implementation path that matches the actual chosen provider and runtime configuration.
