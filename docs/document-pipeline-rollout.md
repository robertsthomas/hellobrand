# Document Pipeline Rollout

This is the operational playbook for shipping the Document AI-backed document pipeline safely.

## Rollout controls

The code supports these env vars:

- `DOCUMENT_PIPELINE_V2_FORCE_LEGACY=1`
  - hard disable switch for Document AI-backed parsing and extraction
- `DOCUMENT_PIPELINE_V2_ALLOWED_KINDS=invoice,contract,campaign_brief,deliverables_brief,pitch_deck`
  - limits v2 to specific document kinds
- `DOCUMENT_PIPELINE_V2_COHORT_PERCENT=0-100`
  - stable workspace cohort rollout by hashed deal/document identity
- `DOCUMENT_PIPELINE_V2_ALLOWED_USER_IDS=user_1,user_2`
  - allowlist for internal testing before cohort rollout

Recommended rollout order:

1. allowlisted internal users only
2. `invoice` only
3. `invoice,contract`
4. add brief/deck kinds after the Google-side schema/setup ticket is complete
5. raise cohort percent gradually from `5` -> `25` -> `50` -> `100`

## What to measure

Observability artifacts are written into the existing `DocumentArtifact` table with `kind = "observability"`.

Track at minimum:

- route selected
- processor used
- fallback route / fallback usage
- per-step duration
- pages processed
- estimated cost
- extraction confidence
- open review-item count
- failure rate

The utility in `lib/document-pipeline-observability.ts` summarizes these artifacts per `DocumentRun`.

## Validation plan

Before widening rollout:

1. run the local verification scripts against representative files in `example-docs/`
2. compare v2 extraction against the current legacy output for:
   - invoice
   - contract
   - brief
3. inspect:
   - auto-applied fields
   - pending review items
   - fallback frequency
   - confidence quality
4. confirm estimated cost stays within expected bounds

## In-flight document handling

- Do not backfill all historical documents immediately.
- New uploads should use the rollout rules first.
- Existing in-flight documents should continue their currently assigned run.
- If a run fails during rollout, retry on the same pipeline path first before changing rollout flags.

## Cutover plan

We can retire the legacy monolithic path only after:

- `invoice` path is stable at `100%`
- `contract` path is stable at `100%`
- brief/deck path is stable enough to keep review-needed rates acceptable
- fallback rate is low and intentional
- support / manual-review load is manageable

Keep `DOCUMENT_PIPELINE_V2_FORCE_LEGACY` as the emergency rollback switch until the legacy path is fully removed.
