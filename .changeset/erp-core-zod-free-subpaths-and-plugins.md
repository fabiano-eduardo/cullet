---
"@cullet/erp-core": minor
---

Add zod-free subpaths for the stable core primitives and a value-object equality plugin system.

- **New subpath exports**, each importable without pulling in the policy engines (and therefore `zod`): `@cullet/erp-core/domain` (`Entity`, `ValueObject`, `DeepReadonly`, `ValueObjectPluginContract`), `./result` (`Result`, `Ok`, `Err`, `Outcome`, `CommonOutcomeStatus`), `./exceptions` (the full domain-exception hierarchy — `DomainException`, `InvariantViolationException`, `InvalidStateTransitionException`, `BusinessRuleViolationException`, `EntityNotFoundException`, `ValidationException`/`InvalidValueException`/`MultipleValidationException`/`ValidationViolation`, `ValidationCode`, `ValidationField`), `./rulesets` (`RulesetRegistry` + the ruleset contracts) and `./versioning` (the `@version` decorator and domain-event contracts). Previously these were reachable only from the root barrel, which transitively imports `zod`. Every symbol stays re-exported from the root too.
- **`ValueObject.plugins`** — a new `PluginManager`-backed extension point (`./plugins` subpath). `ValueObject.equals` is no longer abstract: it delegates to the registered equality plugin and falls back to a structural `JSON.stringify` comparison when none is registered, so hosts can register one comparator (e.g. `lodash.isEqual`) instead of implementing `equals` on every value object. Subclasses that already override `equals` are unaffected.
- **`zod` is now an optional peer dependency.** Only the `./policies` subpath (gate/compute engines) requires it; every other subpath is zod-free.

All additive — no breaking changes for existing consumers.
