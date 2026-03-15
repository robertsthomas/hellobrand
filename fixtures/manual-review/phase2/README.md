## Phase 2 manual review fixtures

Use these files to test:

- category normalization
- disclosure obligation extraction
- contact extraction
- deliverables and timeline normalization
- cross-deal conflict warnings

Recommended flow:

1. Create a new deal from `lunchables-offer-email.txt` and `lunchables-agreement.txt`
2. Confirm the deal workspace
3. Create a second deal from `netflix-campaign-email.txt` and `netflix-creative-brief.txt`
4. Confirm the second deal workspace

Expected behavior:

- `Lunchables` should normalize into `Food & beverage`
- `OREO Cakesters` should normalize into `Food & beverage`
- Both deals should show disclosure / approval reminders
- Both deals should show a schedule overlap warning because the live windows overlap
- Both deals should show a category conflict because they sit in the same food / snack category
- Both deals should show competitor restriction warnings because each one restricts snack / cookie / packaged food competitors
- Both deals should show an exclusivity overlap warning because the live windows overlap while category restrictions are active

These fixtures are intentionally aggressive so the conflict engine has multiple high-signal overlaps to detect in a single manual review pass.
