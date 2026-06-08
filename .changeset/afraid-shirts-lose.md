---
"@cullet/dummy-api": patch
"@cullet/erp-core": patch
"cullet": patch
---

Reescreve a descrição do pacote para refletir a entrega dupla do cullet — kits de biblioteca importáveis e kits de tooling copy-first via CLI — e a deixa consistente entre package.json e a saída do `cullet --help`. Só cullet entra (o package.json raiz é private, não publica). O reformat não precisa de changeset: a tarball publicada leva dist/ buildado, cuja saída não muda com a reformatação do src/.
