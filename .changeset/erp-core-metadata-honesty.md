---
"@cullet/erp-core": patch
"cullet": patch
---

Align kit metadata with what the package actually ships and fix doc/packaging gaps. No runtime or public API changes.

- **Description** is now consistent and honest across all three surfaces (`package.json`, `meta.json`, and the CLI registry). The previous one-liners advertised "temporality" and "rule sets", neither of which is part of the public root barrel — temporal domain primitives (`Timeline<T>`, `ValidTime`, …) are deliberately not exported (only the temporal *error* surface and policy as-of are), and rulesets ship under `examples/` as reference material, not as the kit's domain surface.
- **`meta.json` `engines.node`** now matches the floor npm actually enforces from `package.json` (`>=18` → `>=18.17`), so `cullet info` no longer advertises a lower minimum than the package allows. The kit scaffolding template (`templates/kit/meta.json`) is corrected the same way so `new-kit` cannot reintroduce the drift.
- **`meta.json` `changelog`** was stale at `1.0.0`; it now lists every released version through `1.0.6`.
- **README** doc links to `PHILOSOPHY.md` and `kits/VERSIONING.md` had the wrong relative depth (`../../../../` → `../../`) and 404'd both in-repo and on npm. The "breaking change" guidance now points at the canonical workspace flow (bump a new MAJOR via changeset) instead of the deprecated `versions/2.0.0/` directory layout.
- **`LICENSE`** is now shipped inside the package (the manifest declared `"license": "MIT"` but no license text was included in the tarball), matching the `cullet` CLI package.
