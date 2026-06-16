---
"@cullet/erp-core": patch
---

Document the public API surface with TSDoc.

Add house-style TSDoc blocks (explaining the _why_, not just the _what_) to the headline exports that previously shipped bare in the published `.d.ts`:

- **Domain**: `Entity` (class, constructor, getters, `markAsModified`) and `ValueObject` (class, constructor, `toJSON`/`equals`/`toPrimitive`), including the identity-vs-value distinction and the immutability/optimistic-concurrency contracts.
- **Errors**: `AppError` and its subclasses — `ValidationError`, `NotFoundError`, `ConflictError` (plus `AlreadyExistsError`/`DuplicateError`/`UniqueConstraintViolationError` factories and `translateUniqueViolationToDuplicate`), `AuthorizationError` (and its factories), and `IntegrationError`.
- **Policies**: `PolicyService` (class + `evaluate` + the `EvaluateInput`/`PolicyServiceParams`/`PolicyEvaluationResult` contracts), `PolicyCatalog` (constructor + lookup methods), and `PolicyResolver.resolveBest`.

Documentation only — no runtime behavior change. This bumps the patch version because the comments ship in the published `.d.ts` (consumed by editors and tools like Context7).
