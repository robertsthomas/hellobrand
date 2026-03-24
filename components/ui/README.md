# Primitive Layer

`components/ui` is the strict primitive layer for the app.

This folder is for:

- generic controls
- generic layout containers
- generic overlays
- Radix wrappers
- token-backed variants

This folder is not for:

- feature copy
- domain-specific labels
- data fetching
- business logic
- creator, deal, intake, billing, or inbox-specific abstractions

Guidelines:

- prefer semantic Tailwind tokens like `bg-primary` and `text-muted-foreground`
- avoid raw hex values in shared primitives unless there is no token yet
- expose variants and slots instead of feature-specific booleans
- if a component starts needing product language, move that composition to `components/patterns`
