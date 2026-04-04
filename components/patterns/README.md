# Patterns Layer

`components/patterns` is the app-facing composition layer above reusable components.

Use this folder for HelloBrand patterns such as:

- section headers
- empty states
- settings panels
- split headers with actions
- stacked metric summaries
- feature-specific compositions under nested folders like `patterns/intake`

Rules:

- compose primitives from `components/ui`, `components/generic`, or feature-level reusable components
- do not fetch data here
- keep props product-aware
- patterns can be specific to a feature environment like intake
- if a pattern becomes fully generic, promote it down into a reusable component layer
