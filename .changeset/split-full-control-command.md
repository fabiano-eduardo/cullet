---
---

refactor: dividir o comando `fc` (full-control) em módulos coesos.

O `full-control.ts`, que havia crescido para ~760 linhas, teve seus helpers
internos movidos para módulos sob `commands/full-control/` (transaction, files,
prompts, output, install, library, tooling). O arquivo de entrada mantém os
mesmos exports públicos, então nenhum import externo muda. Movimento puro de
código — sem alteração de comportamento, portanto não há bump de versão.
