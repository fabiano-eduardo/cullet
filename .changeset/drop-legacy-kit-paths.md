---
"cullet": minor
---

Remove o comando `cullet migrate` e os caminhos legados de resolução de kits
(`kits/<name>/versions/<v>/` e `dist/kits/<name>/versions/<v>/`).

O layout canônico passa a ser a única fonte de resolução: no repositório os kits
são lidos de `packages/<name>/`, e no pacote publicado a resolução para
full-control caminha pelo `node_modules` do consumidor. O `migrate` dependia
exclusivamente do layout versionado antigo — que não existe mais —, então já era
vestigial. Também foram removidos `resolveBuiltKitDir`, `kitDistEntryRelative` e
o aviso de divergência de metadados `src`↔`dist`, todos atrelados a esse layout.
