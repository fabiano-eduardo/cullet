# @cullet/erp-core

## 1.4.0

### Minor Changes

- 32c5693: Add a zod-free ABAC module and the `./abac` subpath.
    - **New `@cullet/erp-core/abac` subpath** (importable without pulling in the policy engines or `zod`): `AbacRule` (a PERMIT/DENY effect plus a condition over attributes, reusing the gate/compute condition DSL) and `AbacPolicySet` (rules + a combining algorithm + a default effect). Every symbol is also re-exported from the root.
    - **`AbacAuthorizer`** — a pure, I/O-free decisor that answers "do these attributes authorize this action?" and returns a `Result<AbacDecision, AuthorizationError>`, never throwing. It reuses the gate engine's pure condition evaluator as a matcher, then resolves the matched rules with the set's combining algorithm (`deny-overrides` by default, plus `permit-overrides` / `first-applicable`). Closed by default: a request matching nothing is denied. A condition-evaluation failure (a missing attribute, a wrong-typed operand) fails closed as `AuthorizationError.forbidden`; a rule denial maps to `AuthorizationError.policyDenied`, attributed to the deciding rule's id/version. No new error surface was needed.
    - **`abacContext(request)`** — flattens an `AbacRequest`'s `subject`/`resource`/`action`/`environment` attribute bags into the nested context a rule's dotted `field` (e.g. `resource.status`) resolves against.
    - **`AbacAuthorizerPort`** — the application seam (symmetric to RBAC's `AuthorizerPort`) a use case injects; the consumer's adapter resolves the dynamic attributes and delegates to `AbacAuthorizer`.
    - **`CompositeAuthorizer`** — sequences an RBAC `AuthorizerPort` then an `AbacAuthorizerPort`, short-circuiting on the RBAC denial: the standard hybrid "does the actor hold the capability, _and_ do the attributes allow it here?" flow.

    All additive — no breaking changes for existing consumers.

- 32c5693: Add a zod-free RBAC module and the `./rbac` subpath.
    - **New `@cullet/erp-core/rbac` subpath** (importable without pulling in the policy engines or `zod`): the pure domain primitives `Permission` (`"resource:action"` with single-level wildcards), `Role`, `Grant` (a role binding: actor ↔ role ↔ scope), `Scope` (`"tenant:{id}"` / `"school:{id}"` / global `"*"`) and `PermissionSet`. `Role` and `Grant` round-trip through `toPrimitive`/`fromProps` for persistence. Every symbol is also re-exported from the root.
    - **`RbacAuthorizer`** — a pure decisor with no I/O and no clock that answers "may this actor perform this action in this scope?" and returns a `Result<void, AuthorizationError>`. Authorization decisions are always values, never thrown; it runs role → capability → scope so the denial carries the most informative `reason` (`missing_role` / `missing_capability` / `out_of_scope`). A wildcard `required` permission is caller misuse and throws `InvalidValueException`.
    - **`AuthorizerPort`** — the application seam (symmetric to `PolicyPort`) a use case injects; the consumer's adapter loads the actor's grants and delegates to `RbacAuthorizer`. This fills the `AuthorizerPort` extension point KIT_CONTEXT.md already promised.
    - **`AuthorizationError.missingRole(...)`** plus the dedicated `ErrorCodes.authorization.missingRole` (`"sec.authz.missing_role"`) — the actor holds no relevant role at all, distinct from `missingCapability`.
    - **`rbacContextFields(actor, grants)`** — an optional bridge that projects an actor's roles/permissions into flat `actor.roles`/`actor.permissions` fields for a declarative gate policy (ABAC), without importing the engine or `zod`.

    All additive — no breaking changes for existing consumers.

## 1.3.0

### Minor Changes

- e4f08ed: Add zod-free subpaths for the stable core primitives and a value-object equality plugin system.
    - **New subpath exports**, each importable without pulling in the policy engines (and therefore `zod`): `@cullet/erp-core/domain` (`Entity`, `ValueObject`, `DeepReadonly`, `ValueObjectPluginContract`), `./result` (`Result`, `Ok`, `Err`, `Outcome`, `CommonOutcomeStatus`), `./exceptions` (the full domain-exception hierarchy — `DomainException`, `InvariantViolationException`, `InvalidStateTransitionException`, `BusinessRuleViolationException`, `EntityNotFoundException`, `ValidationException`/`InvalidValueException`/`MultipleValidationException`/`ValidationViolation`, `ValidationCode`, `ValidationField`), `./rulesets` (`RulesetRegistry` + the ruleset contracts) and `./versioning` (the `@version` decorator and domain-event contracts). Previously these were reachable only from the root barrel, which transitively imports `zod`. Every symbol stays re-exported from the root too.
    - **`ValueObject.plugins`** — a new `PluginManager`-backed extension point (`./plugins` subpath). `ValueObject.equals` is no longer abstract: it delegates to the registered equality plugin and falls back to a structural `JSON.stringify` comparison when none is registered, so hosts can register one comparator (e.g. `lodash.isEqual`) instead of implementing `equals` on every value object. Subclasses that already override `equals` are unaffected.
    - **`UuidIdentifier`** (from `@cullet/erp-core/domain`) — an abstract `ValueObject<string, string>` base for UUID-backed typed identifiers. It owns the UUID format check in one place (`UuidIdentifier.isValid`) and carries a phantom `TBrand` type parameter so concrete ids (e.g. `class OrderId extends UuidIdentifier<"OrderId">`) stay nominally incompatible despite their identical `string` shape. Subclasses supply their own validating `create`/`reconstitute`.
    - **`zod` is now an optional peer dependency.** Only the `./policies` subpath (gate/compute engines) requires it; every other subpath is zod-free.

    All additive — no breaking changes for existing consumers.

### Patch Changes

- e4f08ed: Ship a dual ESM/CJS build so CommonJS consumers can import the subpaths.

    `tsdown` now emits both formats (`format: ["esm", "cjs"]`), and `package.json`
    adds a `require` condition — resolving to the `.cjs` output with `.d.cts`
    types — next to the existing `import` condition for every subpath, plus
    `main`/`module`/`typesVersions`. The package was previously ESM-only, so
    importing a subpath such as `@cullet/erp-core/errors` from a CommonJS project
    (`moduleResolution: node16`/`nodenext`) failed type-checking with TS1479 and
    would throw `ERR_REQUIRE_ESM` at runtime.

## 1.2.0

### Minor Changes

- 90d67d8: Add zod-free subpaths for the stable core primitives and a value-object equality plugin system.
    - **New subpath exports**, each importable without pulling in the policy engines (and therefore `zod`): `@cullet/erp-core/domain` (`Entity`, `ValueObject`, `DeepReadonly`, `ValueObjectPluginContract`), `./result` (`Result`, `Ok`, `Err`, `Outcome`, `CommonOutcomeStatus`), `./exceptions` (the full domain-exception hierarchy — `DomainException`, `InvariantViolationException`, `InvalidStateTransitionException`, `BusinessRuleViolationException`, `EntityNotFoundException`, `ValidationException`/`InvalidValueException`/`MultipleValidationException`/`ValidationViolation`, `ValidationCode`, `ValidationField`), `./rulesets` (`RulesetRegistry` + the ruleset contracts) and `./versioning` (the `@version` decorator and domain-event contracts). Previously these were reachable only from the root barrel, which transitively imports `zod`. Every symbol stays re-exported from the root too.
    - **`ValueObject.plugins`** — a new `PluginManager`-backed extension point (`./plugins` subpath). `ValueObject.equals` is no longer abstract: it delegates to the registered equality plugin and falls back to a structural `JSON.stringify` comparison when none is registered, so hosts can register one comparator (e.g. `lodash.isEqual`) instead of implementing `equals` on every value object. Subclasses that already override `equals` are unaffected.
    - **`UuidIdentifier`** (from `@cullet/erp-core/domain`) — an abstract `ValueObject<string, string>` base for UUID-backed typed identifiers. It owns the UUID format check in one place (`UuidIdentifier.isValid`) and carries a phantom `TBrand` type parameter so concrete ids (e.g. `class OrderId extends UuidIdentifier<"OrderId">`) stay nominally incompatible despite their identical `string` shape. Subclasses supply their own validating `create`/`reconstitute`.
    - **`zod` is now an optional peer dependency.** Only the `./policies` subpath (gate/compute engines) requires it; every other subpath is zod-free.

    All additive — no breaking changes for existing consumers.

## 1.1.0

### Minor Changes

- abc62cf: **New: `ResultRepository`, `UseCaseObservability`, and `./application` subpath**

    `ResultRepository<TEntity, TId, TError>` — a `Result`-returning complement to `Repository`. `save` and `delete` resolve to `Result<void, TError>` instead of throwing, keeping persistence failures in-band and composable with the `Command`/`UseCase` error-as-values contract.

    `UseCaseObservability` — an opt-in adapter interface (logger, metrics, tracer) injected by overriding `UseCase.observability()`. When no adapters are provided `run()` delegates directly with zero overhead; when any are present every execution is automatically traced, timed, counted, and failure-logged.

    `RequestedBy` / `RequestedByKind` — now re-exported from the top-level application surface (previously only reachable via the commands barrel).

    **New subpath export** `@cullet/erp-core/application` — lighter import path for application-layer types without pulling in the full erp-core barrel.

    **Renamed**: `PolicyEvaluationError` (type alias on `PolicyPort`) → `PolicyPortError`, to avoid a name collision with the `PolicyEvaluationError` class exported by the policies module.

## 1.0.11

### Patch Changes

- 27df407: Document the public API surface with TSDoc.

    Add house-style TSDoc blocks (explaining the _why_, not just the _what_) to the headline exports that previously shipped bare in the published `.d.ts`:
    - **Domain**: `Entity` (class, constructor, getters, `markAsModified`) and `ValueObject` (class, constructor, `toJSON`/`equals`/`toPrimitive`), including the identity-vs-value distinction and the immutability/optimistic-concurrency contracts.
    - **Errors**: `AppError` and its subclasses — `ValidationError`, `NotFoundError`, `ConflictError` (plus `AlreadyExistsError`/`DuplicateError`/`UniqueConstraintViolationError` factories and `translateUniqueViolationToDuplicate`), `AuthorizationError` (and its factories), and `IntegrationError`.
    - **Policies**: `PolicyService` (class + `evaluate` + the `EvaluateInput`/`PolicyServiceParams`/`PolicyEvaluationResult` contracts), `PolicyCatalog` (constructor + lookup methods), and `PolicyResolver.resolveBest`.

    Documentation only — no runtime behavior change. This bumps the patch version because the comments ship in the published `.d.ts` (consumed by editors and tools like Context7).

## 1.0.10

### Patch Changes

- e75065d: Stop the `meta.json` `changelog` from drifting and clarify the `ValueObject` freeze contract.
    - **`meta.json` `changelog` is now projected from `CHANGELOG.md`** (the Changesets source of truth) by `scripts/sync-kit-version.mjs`, which already runs in `changeset:version` and is gated by `sync-kit-version:check` in CI. The contract changelog had silently drifted because it was hand-maintained in parallel with `CHANGELOG.md`: `erp-core` was missing `1.0.7`/`1.0.8` and `dummy-api` was missing `1.0.1`–`1.0.3`. Both are now complete and can no longer fall behind a release. The synthetic `1.0.0 - Initial scaffold` line drops, since it predates Changesets and has no `CHANGELOG.md` entry.
    - **`ValueObject.finalize()` now documents the freeze contract**: `value` is always deep-frozen by the constructor, but the instance shell is frozen only when a subclass calls `finalize()` at the end of its constructor (so subclasses can still assign their own fields after `super(value)`). No runtime behavior change.

## 1.0.9

### Patch Changes

- 3f9bb57: Harden erp-core invariants and error serialization:
    - `PolicyDefinition` now rejects incoherent bounds at construction — `effectiveTo` at or before `effectiveFrom`, and `contextVersionMin` greater than `contextVersionMax` — throwing `InvariantViolationException`, consistent with how it already validates `policyVersion` and engine versions.
    - `makeImmutable` now surfaces a value that `structuredClone` cannot clone (function, symbol, class instance) as an `InvariantViolationException` instead of leaking the host-specific `DataCloneError`.
    - `AppError.toJSON()` emits optional fields only when defined, so the serialized object no longer carries `undefined`-valued keys (the `JSON.stringify` output is unchanged).

## 1.0.8

### Patch Changes

- 324956e: Align kit metadata with what the package actually ships and fix doc/packaging gaps. No runtime or public API changes.
    - **Description** is now consistent and honest across all three surfaces (`package.json`, `meta.json`, and the CLI registry). The previous one-liners advertised "temporality" and "rule sets", neither of which is part of the public root barrel — temporal domain primitives (`Timeline<T>`, `ValidTime`, …) are deliberately not exported (only the temporal _error_ surface and policy as-of are), and rulesets ship under `examples/` as reference material, not as the kit's domain surface.
    - **`meta.json` `engines.node`** now matches the floor npm actually enforces from `package.json` (`>=18` → `>=18.17`), so `cullet info` no longer advertises a lower minimum than the package allows. The kit scaffolding template (`templates/kit/meta.json`) is corrected the same way so `new-kit` cannot reintroduce the drift.
    - **`meta.json` `changelog`** was stale at `1.0.0`; it now lists every released version through `1.0.6`.
    - **README** doc links to `PHILOSOPHY.md` and `kits/VERSIONING.md` had the wrong relative depth (`../../../../` → `../../`) and 404'd both in-repo and on npm. The "breaking change" guidance now points at the canonical workspace flow (bump a new MAJOR via changeset) instead of the deprecated `versions/2.0.0/` directory layout.
    - **`LICENSE`** is now shipped inside the package (the manifest declared `"license": "MIT"` but no license text was included in the tarball), matching the `cullet` CLI package.

## 1.0.7

### Patch Changes

- bb8e581: Make the kit source nodenext-safe so the full-control copy (`npx cullet fc erp-core`) compiles and runs beyond a bundler.
    - Every relative import/export now carries an explicit extension (`./x.js`, `./dir/index.js`). The published `src/` previously shipped 408 extensionless specifiers authored for `moduleResolution: bundler`, so the copied tree failed to typecheck under `node16`/`nodenext` (375 `TS2835`/`TS2834` errors) and threw `ERR_UNSUPPORTED_DIR_IMPORT` under native Node ESM. The copied tree now typechecks cleanly under both `bundler` and `nodenext` and runs under native Node ESM.
    - Marked the type-only `static CONTRACT_VERSION` contract on `Entity`, `ValueObject` and `UseCase` with `declare`. The value is supplied at runtime by the `@version` decorator, but without `declare` the field was also emitted by `useDefineForClassFields`, crashing with `TypeError: Cannot redefine property: CONTRACT_VERSION` when the copy was compiled under a modern default tsconfig (standard decorators). With `declare` the field is type-only, so the copy runs under both the standard and the legacy (`experimentalDecorators`) decorator modes.
    - Re-enabled the `nodenextImports` source lint (`off` → `warn`), matching the kit template and `dummy-api`, so the regression cannot silently return.

    No public API or runtime behavior changes for existing consumers — only import specifiers, a type-only field modifier, and lint configuration.

## 1.0.6

### Patch Changes

- 93696ef: Harden recursive utilities and tighten a few correctness contracts:
    - **json-safe metadata**: `assertJsonSafeMetadata` no longer overflows the stack on circular metadata — true cycles collapse to a new `[Circular]` placeholder, while acyclic shared references are still serialized. This keeps `AppError` construction safe with arbitrary `metadata`.
    - **immutability**: `deepFreeze`/`makeImmutable` freeze cyclic graphs instead of overflowing the stack.
    - **hashing**: `stableStringify`/`payloadHash` and `PolicyHashing.canonicalJson` reject circular structures with a clear `TypeError` instead of a stack overflow; their `JSON.stringify` semantics are now documented.
    - **semver**: `comparePolicySemver` preserves hyphenated pre-release identifiers (e.g. `1.0.0-x-1`) instead of truncating at the first hyphen.
    - **Entity**: `markAsModified` re-enforces the `updatedAt >= createdAt` invariant already guaranteed by the constructor.
    - **condition evaluator**: relational operators reject non-numeric operands and `in`/`notIn` reject non-array operands (reported as `INVALID_NUMERIC_OPERAND` / `INVALID_SET_OPERAND`) instead of silently evaluating to `false`.

## 1.0.5

### Patch Changes

- a2a8a02: Expand internal test coverage for previously untested or thinly-tested units: policy error mapping and policy-evaluation error kinds (`INVALID_POLICY_KEY`, `POLICY_DEFINITION_NOT_FOUND`), the conflict/serialization/idempotency error catalogs, `AppError.toJSON`, `RequestedBy`, `PolicyKey`, policy semver comparison, and the in-memory policy definition repository's eligibility filtering. No runtime or public API changes — spec files are excluded from the published package.

## 1.0.4

### Patch Changes

- bd5111e: fix(erp-core): return an error when an AND node has no child conditions

    `ConditionEvaluatorV1` now rejects empty `and` arrays the same way it already
    rejects empty `or` arrays, returning a tagged `EMPTY_AND_CONDITION` error
    instead of silently evaluating to `true`.

## 1.0.3

### Patch Changes

- a152160: Reescreve a descrição do pacote para refletir a entrega dupla do cullet — kits de biblioteca importáveis e kits de tooling copy-first via CLI — e a deixa consistente entre package.json e a saída do `cullet --help`. Só cullet entra (o package.json raiz é private, não publica). O reformat não precisa de changeset: a tarball publicada leva dist/ buildado, cuja saída não muda com a reformatação do src/.

## 1.0.2

### Patch Changes

- 7722608: erp-core declara explicitamente os lints de arquitetura em camadas; o catálogo passa a ser neutro de arquitetura.

## 1.0.1

### Patch Changes

- 69bc321: Corrige os exemplos de consumo nos READMEs dos kits: o import direto usa o nome npm com escopo (`@cullet/<kit>`) e o argumento do `npx cullet fc` é o nome do kit no registry (`erp-core`), não o nome com escopo. Adiciona a nota explicando o que o `fc` faz no `erp-core`.
