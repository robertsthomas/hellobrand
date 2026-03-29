# Implementation Overview

## ROB-125: Cross-Deal Conflict Precision Tests

### `tests/conflict-precision.test.ts`
15 test scenarios exercising `buildConflictResults()`. Covers all 4 conflict types (category_conflict, schedule_collision, competitor_restriction, exclusivity_overlap), false positive prevention, completed/unconfirmed deal exclusion, and confidence range validation. Uses a `makeDealAggregate()` helper built from seed data.

---

## ROB-129: Creator-Rights Analyzer Tests

### `tests/creator-rights.test.ts`
13 test scenarios for `fallbackAnalyzeContract()` against 6 contract fixtures. Validates each risk category (usage_rights, exclusivity, payment_terms, deliverables, termination, other) triggers at the correct severity and that `suggestedAction` contains actionable verbs.

### `fixtures/contracts/*.txt`
Synthetic contract snippets designed to trigger specific risk flags:
- `perpetual-usage-rights.txt` — perpetual worldwide usage rights (high severity)
- `one-sided-termination.txt` — terminate immediately without notice
- `long-payment-terms.txt` — Net 60 payment terms
- `exclusivity-restriction.txt` — 90-day category exclusivity
- `vague-deliverables.txt` — TBD/as-requested deliverables
- `mixed-risk-contract.txt` — combines 3+ risk categories

---

## ROB-127: Manual Edit Preservation

### `prisma/schema.prisma`
Added `manuallyEditedFields Json @default("[]")` to `DealTerms`. Stores an array of field names the user has hand-edited.

### `lib/types.ts`
Added `manuallyEditedFields: string[]` to `DealTermsRecord`.

### `lib/deals.ts`
- `detectChangedFields()` — compares scalar fields between existing terms and a user patch, returns changed keys.
- `mergeTerms()` — accepts an optional `manuallyEditedFields` list and skips those keys when applying AI re-extraction patches. Preserves user corrections during document reprocessing.
- `updateTermsForViewer()` — accumulates changed fields into `manuallyEditedFields` on every manual save.
- `processDocumentPipeline()` — passes existing manual edits through so re-processing never overwrites user corrections.

### `lib/analysis/fallback.ts`
Added `manuallyEditedFields: []` to `createEmptyTerms()`.

### `lib/repository/prisma-repository.ts`
Maps `manuallyEditedFields` between JSON (Prisma) and `string[]` (app) in `toDealTermsRecord()` and `upsertTerms()`.

### `lib/repository/file-repository.ts`
Added `manuallyEditedFields` fallback in `normalizeStore()`.

### `lib/repository/seed.ts`
Added `manuallyEditedFields: []` to seed terms.

---

## ROB-126: Brief & Concept Overview Panel

### `prisma/schema.prisma`
Added `briefData Json?` to `DealTerms`. Stores extracted campaign brief fields.

### `lib/types.ts`
Added `BriefData` interface with: `campaignOverview`, `messagingPoints`, `talkingPoints`, `creativeConceptOverview`, `brandGuidelines`, `approvalRequirements`, `targetAudience`, `toneAndStyle`, `doNotMention`, `sourceDocumentIds`. Added `briefData: BriefData | null` to `DealTermsRecord`.

### `lib/analysis/fallback.ts`
`extractBriefData()` — regex-based extraction for campaign_brief, deliverables_brief, and pitch_deck documents. Pulls campaign overview, messaging points, creative concepts, brand guidelines, target audience, tone, and "do not mention" lists. Returns `null` for other document kinds.

### `lib/analysis/llm.ts`
`extractBriefWithLlm()` — sends brief text to the LLM with a structured prompt asking for BriefData fields. Falls back to the heuristic result on failure.

### `lib/deals.ts`
- `mergeBriefData()` — merges two BriefData objects, preferring non-null from the patch and deduplicating sourceDocumentIds.
- `mergeTerms()` — handles briefData separately via `mergeBriefData()`.
- `processDocumentPipeline()` — after the merge_results stage, extracts brief data for brief-type documents using fallback then optionally LLM.

### `components/brief-overview.tsx`
Client component rendering BriefData in a two-column grid: campaign overview, messaging points, talking points, creative concept, brand guidelines, approval requirements, target audience, tone & style, do-not-mention list. Shows source document file names and a graceful empty state when no brief is uploaded.

### `app/app/p/[dealId]/page.tsx`
Added "Brief" tab between Deliverables and Emails, rendering `<BriefOverview>` with the deal's brief data and documents list for source attribution.

### Repository updates
- `prisma-repository.ts` — maps `briefData` JSON to `BriefData | null`.
- `file-repository.ts` — added `briefData` fallback in `normalizeStore()`.
- `seed.ts` — added `briefData: null` to seed terms.

---

## ROB-132: Bulk Deal Intake

### `prisma/schema.prisma`
Two new models:
- `IntakeBatch` — represents a multi-file upload session. Fields: `id`, `userId`, `status` (clustering/review/confirmed/failed), timestamps. Has many `IntakeBatchGroup`s.
- `IntakeBatchGroup` — one detected deal within a batch. Fields: `id`, `batchId`, `intakeSessionId` (set on confirmation), `label` (detected brand name), `confidence`, `documentIds` (JSON array), `status` (pending/confirmed/rejected).

Added `intakeBatches` relation to `User` and `batchGroup` relation to `IntakeSession`.

### `lib/types.ts`
Added `IntakeBatchStatus`, `IntakeBatchGroupStatus` types and `IntakeBatchRecord`, `IntakeBatchGroupRecord` interfaces.

### `lib/intake-clustering.ts`
Pure heuristic document clustering — no LLM required.
- `extractBrandFromText()` — regex patterns matching "Brand: X", "partnership with X", "between X", etc.
- `extractBrandFromFileName()` — strips file extensions and stop words (contract, agreement, brief, etc.), returns remaining tokens as brand candidate.
- `normalizeBrand()` — lowercases and strips non-alphanumeric for grouping comparison.
- `clusterDocuments()` — groups documents by normalized brand name. Assigns orphan documents to the largest group or an "Unknown" group. Returns groups with confidence (0.9 for text-extracted, 0.6 for filename-inferred).

### `lib/intake.ts`
- `createBulkIntakeForViewer()` — uploads all files to a temporary deal, extracts text, runs `clusterDocuments()`, creates an `IntakeBatch` with groups. Single-group results create a standard `IntakeSession` directly (same UX as current single-deal flow).
- `getBatchForViewer()` — fetches batch state for a viewer.
- `confirmBatchGroupForViewer()` — creates a new Deal + IntakeSession for one group, copies documents from the temp deal, links them to the new session. Marks the group as confirmed. When all groups are processed, marks the batch as confirmed.
- `reassignDocumentInBatch()` — moves a document ID from one group to another within a batch.

### `lib/repository/prisma-repository.ts`
Batch CRUD methods:
- `createBatch()` — creates IntakeBatch + IntakeBatchGroups in one transaction.
- `getBatch()` — fetches batch with groups ordered by creation date.
- `updateBatchGroup()` — updates label, status, intakeSessionId, or documentIds on a group.
- `updateBatchStatus()` — updates batch-level status.

Conversion helpers `toBatchRecord()` and `toBatchGroupRecord()` normalize Prisma types to app record interfaces.

### `lib/repository/file-repository.ts`
Stub implementations for the JSON file fallback:
- `createBatch()` — returns an in-memory record (works for single-group fast path).
- `getBatch()` — returns null (batches require a database).
- `updateBatchGroup()` — throws an error (batch operations require a database).
- `updateBatchStatus()` — no-op.

### `app/api/intake/batch/route.ts`
`POST` — accepts multipart form data with documents and optional notes. Calls `createBulkIntakeForViewer()`, returns the batch with its groups.

### `app/api/intake/batch/[batchId]/route.ts`
- `GET` — returns batch state with all groups.
- `PATCH` — dispatches on `action` field:
  - `confirm_group` — creates a deal from a group, returns the new session and deal ID.
  - `reassign_document` — moves a document between groups, returns updated batch.

### `app/app/intake/batch/[batchId]/page.tsx`
Server component for the batch review page. Fetches the batch and resolves document IDs to file names. Renders a back link, page header ("Review detected deals"), explanatory text, and the `<BatchReviewPanel>`.

### `components/batch-review-panel.tsx`
Client component showing each group as a card with:
- Group label and confidence percentage.
- Document list with file names and a "Move to..." dropdown for reassigning documents between groups.
- Editable brand name and campaign name fields (pre-filled from the detected label).
- "Create deal" button that calls the confirm API and updates local state.
- Tracks confirmation progress. Auto-navigates to the intake session when the last group is confirmed.

### `app/actions.ts`
Three new server actions:
- `startBulkIntakeAction` — creates a batch from multi-file form data and redirects to the batch review page (or directly to intake for single-group results).
- `confirmBatchGroupAction` — confirms one group within a batch, creating its deal.
- `reassignDocumentAction` — moves a document between groups.

Modified `startIntakeAction` — when more than 1 file is uploaded (without pasted text), automatically routes through `createBulkIntakeForViewer` and the batch flow. Single-file uploads keep existing behavior unchanged.
