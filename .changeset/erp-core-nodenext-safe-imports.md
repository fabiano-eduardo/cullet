---
"@cullet/erp-core": patch
---

Make the kit source nodenext-safe so the full-control copy (`npx cullet fc erp-core`) compiles and runs beyond a bundler.

- Every relative import/export now carries an explicit extension (`./x.js`, `./dir/index.js`). The published `src/` previously shipped 408 extensionless specifiers authored for `moduleResolution: bundler`, so the copied tree failed to typecheck under `node16`/`nodenext` (375 `TS2835`/`TS2834` errors) and threw `ERR_UNSUPPORTED_DIR_IMPORT` under native Node ESM. The copied tree now typechecks cleanly under both `bundler` and `nodenext` and runs under native Node ESM.
- Marked the type-only `static CONTRACT_VERSION` contract on `Entity`, `ValueObject` and `UseCase` with `declare`. The value is supplied at runtime by the `@version` decorator, but without `declare` the field was also emitted by `useDefineForClassFields`, crashing with `TypeError: Cannot redefine property: CONTRACT_VERSION` when the copy was compiled under a modern default tsconfig (standard decorators). With `declare` the field is type-only, so the copy runs under both the standard and the legacy (`experimentalDecorators`) decorator modes.
- Re-enabled the `nodenextImports` source lint (`off` → `warn`), matching the kit template and `dummy-api`, so the regression cannot silently return.

No public API or runtime behavior changes for existing consumers — only import specifiers, a type-only field modifier, and lint configuration.
