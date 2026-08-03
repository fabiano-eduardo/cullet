---
"@cullet/erp-core": major
---

Align the policy catalog with the kit's own error model: it now throws a domain exception instead of an application error.

### Breaking change

- **`PolicyCatalog` / `PolicyCatalogEntry.assertFamilyConsistency`** now throw `InvariantViolationException` instead of `UnexpectedError`. Every one of those throw sites signals a malformed catalog assembled by the developer (an empty family, a duplicate variant, entries sharing a key but disagreeing on `kind`/`owner`/`asOfSource`/`description`) — a broken invariant, not an unforeseen runtime failure. Two things were wrong with `UnexpectedError` there: it hard-codes `severity: "critical"`, so a misconfigured catalog paged the on-call at boot; and it is an `AppError`, which the kit's documented model says is _returned_ inside a `Result`, never thrown. Update any `catch` that matched `instanceof UnexpectedError` around catalog construction. Messages are unchanged.

`mapPolicyEvaluationError` still returns `UnexpectedError` for `ENGINE_FAILURE` — that use is a returned value and stays as is.

### Naming convention

- Domain exceptions that were named with an `Error` suffix are renamed to `*Exception`, so the suffix reliably tells you which hierarchy a class belongs to: `*Exception` is thrown, `*Error` is an `AppError` that travels inside a `Result` and carries `code`/`toJSON()`. Renamed: `RulesetRegistryError` → `RulesetRegistryException`, plus the ruleset examples (`CPFValidationError`, `CPFBlocklistError`, `PersonNameValidationError`, `PersonNameCharacterError`, `OrderCreationValidationError`, `OrderInvariantError`, `OrderCancellationWindowError`). All of these were file-local and never exported, so no public API changes. The rule is now written down in the README's "Como evoluir".
