---
---

refactor(scripts): substitui o scanner de bare `any` baseado em regex por um varredor sobre a AST TypeScript (`findBareAnyUsages` em `kit-ast.mjs`), eliminando falsos positivos com a palavra "any" em comentários, strings, títulos de teste e nomes de propriedade. Remove o `scripts/smoke-test.sh` obsoleto e suas referências nos READMEs. Repo tooling only — no published package changes, so this is an intentionally empty changeset (no version bump / no release).
