---
"@cullet/erp-core": patch
---

Expand internal test coverage for previously untested or thinly-tested units: policy error mapping and policy-evaluation error kinds (`INVALID_POLICY_KEY`, `POLICY_DEFINITION_NOT_FOUND`), the conflict/serialization/idempotency error catalogs, `AppError.toJSON`, `RequestedBy`, `PolicyKey`, policy semver comparison, and the in-memory policy definition repository's eligibility filtering. No runtime or public API changes — spec files are excluded from the published package.
