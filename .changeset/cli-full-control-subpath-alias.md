---
"cullet": patch
---

Fix two full-control (`cullet fc`) gaps for importable kits:

- **Subpath aliases now point at the copy.** Previously only the bare specifier (`@cullet/erp-core`) was aliased to the copied `./cullet/<kit>@<version>/` tree, so the kit's documented subpath exports (e.g. `@cullet/erp-core/errors`) silently resolved back to the original package in `node_modules`. `fc` now also registers a `"<kit>/*"` wildcard with file/barrel/bundler fallback targets, so subpaths resolve to the editable copy under both `bundler` and `node16`/`nodenext`.
- **Honest "no tsconfig" guidance.** When the project has no `tsconfig.json`, `fc` no longer claims the local alias points at the copy (it was not registered). It now explains that importing the package keeps resolving to `node_modules` and tells the user how to edit the copy (relative import or add the `paths`).

Internally, alias registration moved to a batched `upsertPathAliases` so the root and wildcard aliases are written in a single tsconfig read/write with one `baseUrl` advisory.
