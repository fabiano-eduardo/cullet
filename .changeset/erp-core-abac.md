---
"@cullet/erp-core": minor
---

Add a zod-free ABAC module and the `./abac` subpath.

- **New `@cullet/erp-core/abac` subpath** (importable without pulling in the policy engines or `zod`): `AbacRule` (a PERMIT/DENY effect plus a condition over attributes, reusing the gate/compute condition DSL) and `AbacPolicySet` (rules + a combining algorithm + a default effect). Every symbol is also re-exported from the root.
- **`AbacAuthorizer`** — a pure, I/O-free decisor that answers "do these attributes authorize this action?" and returns a `Result<AbacDecision, AuthorizationError>`, never throwing. It reuses the gate engine's pure condition evaluator as a matcher, then resolves the matched rules with the set's combining algorithm (`deny-overrides` by default, plus `permit-overrides` / `first-applicable`). Closed by default: a request matching nothing is denied. A condition-evaluation failure (a missing attribute, a wrong-typed operand) fails closed as `AuthorizationError.forbidden`; a rule denial maps to `AuthorizationError.policyDenied`, attributed to the deciding rule's id/version. No new error surface was needed.
- **`abacContext(request)`** — flattens an `AbacRequest`'s `subject`/`resource`/`action`/`environment` attribute bags into the nested context a rule's dotted `field` (e.g. `resource.status`) resolves against.
- **`AbacAuthorizerPort`** — the application seam (symmetric to RBAC's `AuthorizerPort`) a use case injects; the consumer's adapter resolves the dynamic attributes and delegates to `AbacAuthorizer`.
- **`CompositeAuthorizer`** — sequences an RBAC `AuthorizerPort` then an `AbacAuthorizerPort`, short-circuiting on the RBAC denial: the standard hybrid "does the actor hold the capability, _and_ do the attributes allow it here?" flow.

All additive — no breaking changes for existing consumers.
