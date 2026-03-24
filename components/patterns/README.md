# Patterns Layer

`components/patterns` is the first app-facing layer above `components/ui`.

Use this folder for reusable HelloBrand compositions such as:

- section headers
- empty states
- settings panels
- split headers with actions
- stacked metric summaries

Rules:

- compose primitives from `components/ui`
- do not fetch data here
- keep props product-aware but still reusable across features
- if the same feature layout appears in multiple places, move it here
- if a pattern becomes fully generic, promote it down into `components/ui`
