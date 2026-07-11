---
"@cullet/erp-core": major
---

Harden RBAC/ABAC, the policy condition engine, bitemporal primitives, the Result/Outcome module and the domain-exception hierarchy, plus fix several invariant bugs found while doing so.

### Breaking changes

- **`AuthorizationErrorMetadata.actor`**: `{ userId: string }` is renamed to `{ actorId: string }`, since `RequestedBy.raw` can be a system identity (`"system:<job>"`), not just a user id. Update any code that reads `error.metadata.actor.userId`.
- **`DomainEventContractSelection`**: `{ entity?: boolean; valueObject?: boolean; useCase?: boolean }` becomes `{ entity?: ContractVersioned; valueObject?: ContractVersioned; useCase?: ContractVersioned }` — pass the concrete `@version`-decorated class (e.g. `{ entity: OrderEntity }`) instead of `true`, so the envelope records the class's actual contract version instead of the framework base's.

### RBAC / ABAC

- `RequestedBy` now canonicalizes user UUIDs to lowercase at construction, so a case-differing id (Postgres lowercase vs. a JWT uppercase) still matches downstream exact-string comparators (`Grant.appliesTo`, `rbacContextFields`).
- `AbacAuthorizer` now attributes a fail-closed `forbidden` denial to the culprit rule's `id`/`version`, supports `AbacPolicySet.of(rules, { onEvaluationError: "skip-rule" })` as an escape valve for an unevaluable rule, emits every resolved decision (PERMIT/DENY) as a new `abac-decision` reporter event, and accepts an injectable `clock`. `AbacPolicySet.of` now rejects duplicate rule ids.
- `Role.equals()` now compares permission sets order-insensitively instead of falling back to the base `ValueObject.equals`'s order-sensitive structural comparison.
- `RulesetRegistry.register()` now validates the `RulesetId` shape (`name@major.minor`) at runtime, since the template-literal type only protects TypeScript callers.

### Bug fixes

- `Entity.markAsModified` compared the new `updatedAt` against `createdAt` instead of the current `updatedAt`, so the monotonic-timestamp guard stopped enforcing anything after the first mutation.
- `ValueObject`'s default `equals()` fallback compared only the serialized value, so two unrelated `ValueObject` subclasses wrapping the same primitive (e.g. an `OrderId` and a `CustomerId`) could compare equal through an unsafe cast; it now also requires the same concrete class.
- `deepFreeze` read properties directly while walking an object, invoking accessor getters (possible side effects/throws) during a freeze; it now reads through the property descriptor and only recurses into data properties.
- `payloadHash`/idempotency-key hashing was lossy (`{a: undefined}` and `{}` collided); extracted a strict `canonicalStringify` that rejects values `JSON.stringify` would silently drop or coerce.
- `PolicyCatalogEntry.equals()` and `PolicyCatalog`'s single-variant fallback ignored `kind`, so two different-kind/version variants registered under the same key could be treated as the same entry, or a lookup for one kind could silently return the other.
- `ConditionEvaluatorV1`'s condition-tree schema recursed unbounded, risking a stack overflow on a maliciously deep condition tree; nesting is now capped at 32 levels.
- `version()`'s decorator now throws `InvariantViolationException` instead of a bare `TypeError` for an invalid contract version, consistent with the rest of the domain's error taxonomy.

### Additive

- New `Entity.equals()` (identity-based, class + id) and a constructor guard requiring a non-null `id`.
- New `ResultTemporalRepository` port (the `Result`-returning counterpart of `TemporalRepository`).
- `Query`'s `STALE_WHILE_REVALIDATE` cache strategy gains a second `staleWhileRevalidateMs` window, distinct from `ttlMs`.
- `UseCase` gains a `protected spanAttributes(input)` hook for low-cardinality span/metric dimensions; `Command` uses it to stamp `requested_by.kind`.
- `UUID_PATTERN` now accepts UUID versions 1–8 (including the time-ordered UUIDv7).
- Bitemporal primitives (`createValidTime`, `createTemporalSnapshot`, ranges) are now published on the `./domain` subpath.
- `DomainException` and its subclasses accept an optional `cause`.
- `ValidationCode`/`ValidationField` gain `toString`/`equals`/`toJSON` helpers.
