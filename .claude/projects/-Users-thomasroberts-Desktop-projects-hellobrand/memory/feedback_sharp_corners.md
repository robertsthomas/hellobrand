---
name: Sharp corners are the signature look
description: All cards, panels, and UI containers must use sharp edges (rounded-none), never rounded corners
type: feedback
---

All cards, panels, badges, and containers in the HelloBrand UI must use sharp corners (rounded-none in Tailwind). Do not introduce rounded-[Xpx] or rounded-lg/md/sm on cards or sections.

**Why:** Sharp edges are the brand's signature visual identity. The rest of the app consistently uses rounded-none.

**How to apply:** When writing or reviewing any UI component, default to rounded-none for all container elements. The only exception is small decorative elements like status dots (rounded-full).
