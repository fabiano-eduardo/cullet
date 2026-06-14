---
"@cullet/erp-core": patch
---

Harden recursive utilities and tighten a few correctness contracts:

- **json-safe metadata**: `assertJsonSafeMetadata` no longer overflows the stack on circular metadata — true cycles collapse to a new `[Circular]` placeholder, while acyclic shared references are still serialized. This keeps `AppError` construction safe with arbitrary `metadata`.
- **immutability**: `deepFreeze`/`makeImmutable` freeze cyclic graphs instead of overflowing the stack.
- **hashing**: `stableStringify`/`payloadHash` and `PolicyHashing.canonicalJson` reject circular structures with a clear `TypeError` instead of a stack overflow; their `JSON.stringify` semantics are now documented.
- **semver**: `comparePolicySemver` preserves hyphenated pre-release identifiers (e.g. `1.0.0-x-1`) instead of truncating at the first hyphen.
- **Entity**: `markAsModified` re-enforces the `updatedAt >= createdAt` invariant already guaranteed by the constructor.
- **condition evaluator**: relational operators reject non-numeric operands and `in`/`notIn` reject non-array operands (reported as `INVALID_NUMERIC_OPERAND` / `INVALID_SET_OPERAND`) instead of silently evaluating to `false`.
