# HelloBrand Design System

This repo now treats the design system as three layers:

1. `components/ui`
2. `components/patterns`
3. feature screens in `components` and `app`

## Foundations

Tokens live in:

- `app/globals.css`
- `tailwind.config.ts`
- `lib/design-system/foundation.ts`

Current semantic foundation:

- color tokens for app, feedback, popovers, sidebar, and chart usage
- radius and shadow tokens for shared surfaces
- motion tokens for shared transitions
- named typography roles for docs and product consistency

## Rules

- use semantic tokens before raw colors in shared layers
- primitives in `components/ui` stay generic
- repeated feature layouts move into `components/patterns`
- feature code owns data and business logic
- when a pattern becomes generic, promote it into `components/ui`

## Hosted Surfaces

Human-readable overview:

- `/design-system`

Machine-readable contract:

- `/api/design-system`

The JSON endpoint is intended to make the current system easier to inspect from LLMs and external tooling.
