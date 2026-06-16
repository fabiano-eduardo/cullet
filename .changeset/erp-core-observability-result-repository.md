---
"@cullet/erp-core": minor
---

**New: `ResultRepository`, `UseCaseObservability`, and `./application` subpath**

`ResultRepository<TEntity, TId, TError>` — a `Result`-returning complement to `Repository`. `save` and `delete` resolve to `Result<void, TError>` instead of throwing, keeping persistence failures in-band and composable with the `Command`/`UseCase` error-as-values contract.

`UseCaseObservability` — an opt-in adapter interface (logger, metrics, tracer) injected by overriding `UseCase.observability()`. When no adapters are provided `run()` delegates directly with zero overhead; when any are present every execution is automatically traced, timed, counted, and failure-logged.

`RequestedBy` / `RequestedByKind` — now re-exported from the top-level application surface (previously only reachable via the commands barrel).

**New subpath export** `@cullet/erp-core/application` — lighter import path for application-layer types without pulling in the full erp-core barrel.

**Renamed**: `PolicyEvaluationError` (type alias on `PolicyPort`) → `PolicyPortError`, to avoid a name collision with the `PolicyEvaluationError` class exported by the policies module.
