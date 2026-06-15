---
"@cullet/erp-core": patch
"@cullet/dummy-api": patch
---

Stop the `meta.json` `changelog` from drifting and clarify the `ValueObject` freeze contract.

- **`meta.json` `changelog` is now projected from `CHANGELOG.md`** (the Changesets source of truth) by `scripts/sync-kit-version.mjs`, which already runs in `changeset:version` and is gated by `sync-kit-version:check` in CI. The contract changelog had silently drifted because it was hand-maintained in parallel with `CHANGELOG.md`: `erp-core` was missing `1.0.7`/`1.0.8` and `dummy-api` was missing `1.0.1`–`1.0.3`. Both are now complete and can no longer fall behind a release. The synthetic `1.0.0 - Initial scaffold` line drops, since it predates Changesets and has no `CHANGELOG.md` entry.
- **`ValueObject.finalize()` now documents the freeze contract**: `value` is always deep-frozen by the constructor, but the instance shell is frozen only when a subclass calls `finalize()` at the end of its constructor (so subclasses can still assign their own fields after `super(value)`). No runtime behavior change.
