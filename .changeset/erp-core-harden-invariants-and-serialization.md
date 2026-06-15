---
"@cullet/erp-core": patch
---

Harden erp-core invariants and error serialization:

- `PolicyDefinition` now rejects incoherent bounds at construction — `effectiveTo` at or before `effectiveFrom`, and `contextVersionMin` greater than `contextVersionMax` — throwing `InvariantViolationException`, consistent with how it already validates `policyVersion` and engine versions.
- `makeImmutable` now surfaces a value that `structuredClone` cannot clone (function, symbol, class instance) as an `InvariantViolationException` instead of leaking the host-specific `DataCloneError`.
- `AppError.toJSON()` emits optional fields only when defined, so the serialized object no longer carries `undefined`-valued keys (the `JSON.stringify` output is unchanged).
