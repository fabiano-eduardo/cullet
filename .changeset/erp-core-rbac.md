---
"@cullet/erp-core": minor
---

Add a zod-free RBAC module and the `./rbac` subpath.

- **New `@cullet/erp-core/rbac` subpath** (importable without pulling in the policy engines or `zod`): the pure domain primitives `Permission` (`"resource:action"` with single-level wildcards), `Role`, `Grant` (a role binding: actor ↔ role ↔ scope), `Scope` (`"tenant:{id}"` / `"school:{id}"` / global `"*"`) and `PermissionSet`. `Role` and `Grant` round-trip through `toPrimitive`/`fromProps` for persistence. Every symbol is also re-exported from the root.
- **`RbacAuthorizer`** — a pure decisor with no I/O and no clock that answers "may this actor perform this action in this scope?" and returns a `Result<void, AuthorizationError>`. Authorization decisions are always values, never thrown; it runs role → capability → scope so the denial carries the most informative `reason` (`missing_role` / `missing_capability` / `out_of_scope`). A wildcard `required` permission is caller misuse and throws `InvalidValueException`.
- **`AuthorizerPort`** — the application seam (symmetric to `PolicyPort`) a use case injects; the consumer's adapter loads the actor's grants and delegates to `RbacAuthorizer`. This fills the `AuthorizerPort` extension point KIT_CONTEXT.md already promised.
- **`AuthorizationError.missingRole(...)`** plus the dedicated `ErrorCodes.authorization.missingRole` (`"sec.authz.missing_role"`) — the actor holds no relevant role at all, distinct from `missingCapability`.
- **`rbacContextFields(actor, grants)`** — an optional bridge that projects an actor's roles/permissions into flat `actor.roles`/`actor.permissions` fields for a declarative gate policy (ABAC), without importing the engine or `zod`.

All additive — no breaking changes for existing consumers.
