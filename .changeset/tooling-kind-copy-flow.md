---
"cullet": minor
---

Adiciona o `kind` **tooling**: kits copy-only que declaram `delivery.copy` (placement + payload `files/`) e são mesclados no projeto por `npx cullet fc <kit>`, sem import nem alias de tsconfig. `cullet info`/`list` reconhecem o kind, `validate-kit` aplica o contrato condicional por kind (kits de biblioteca exigem `entryPoint`/`philosophy`/`compatibility`; kits tooling exigem `delivery.copy`), e o `npm run new-kit -- <nome> --kind tooling` faz o scaffold a partir de `templates/tooling-kit/`.
