---
"cullet": minor
---

Expose an à la carte registry API and dogfood it from the CLI: `loadKit` now accepts `{ context?: boolean }` and `CatalogKit` includes `npmName`. Internally, `catalog.ts` was split into focused modules and kit-arg parsing was deduplicated. No CLI behavior change.
