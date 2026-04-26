# Product Analytics Validation

This note records the current verification scope for ROB-70 analytics reporting.

## Source Data

Analytics are built from deal aggregates in `lib/analytics/service.ts`:

- Deal records provide workspace count, status, brand, archive state, and activity dates.
- Deal terms provide the primary partnership value.
- Payment records provide paid, awaiting, late, invoice, and payment timing signals.
- Invoice records provide fallback value and invoice timing signals.
- Profile payout metadata provides connected platform rows when available.

## KPI Definitions

- Tracked revenue: sum of partnership values after archive, brand, status, and date-range filters.
- Active partnerships: filtered workspaces that are not completed or archived.
- Average partnership value: tracked revenue divided by filtered workspace count.
- Awaiting payment: filtered workspaces grouped as awaiting payment or late.
- Monthly revenue: partnership value grouped by the selected range's revenue source date.
- Pipeline breakdown: filtered workspace count and revenue grouped by normalized status bucket.
- Payment health: paid, awaiting, overdue counts and average invoice-to-paid / created-to-confirmed days.

## Repeatable Verification

Run the focused analytics suite:

```bash
pnpm exec vitest run tests/analytics-service.test.ts --reporter=dot
pnpm exec playwright test tests/e2e/analytics.spec.ts --project=premium
```

The unit tests reconcile dashboard metrics against representative deal, term, payment, invoice,
archive, date-range, brand, and status inputs. The E2E tests verify the premium analytics page exposes
filters, drill-down entry points, and empty-state reset behavior.

## Known Limits

- Social/content performance is profile- and workspace-derived today; direct social platform API
  performance metrics are not ingested yet.
- Revenue is operationally tracked from partnership terms first, then payment/invoice fallbacks.
- Metrics are dashboard read-model calculations, not a separate warehouse or historical event stream.
