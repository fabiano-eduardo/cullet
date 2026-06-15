# @cullet/erp-core

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
