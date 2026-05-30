---
title: Versionamento
description: Como o cullet versiona pacote e kits sem quebrar consumidores existentes.
---

`cullet` tem dois níveis de versão:

- O pacote npm `cullet`, definido em `package.json`.
- Cada kit individual, definido por `packages/<nome>/package.json`, repetido em `packages/<nome>/meta.json` e refletido em `registry/index.json`.

## Regras principais

- SemVer é aplicado ao kit, não apenas ao pacote.
- Versões publicadas de kit são imutáveis; correção é sempre uma nova versão npm, nunca reescrita de uma release já publicada.
- `cullet/<nome>` resolve para a `latest` do kit.
- `cullet/<nome>/<versão>` fixa o consumo em uma versão exata.

## Quando abrir uma nova release

- `MAJOR`: mudança incompatível na superfície pública do kit.
- `MINOR`: adição compatível de API ou capacidade.
- `PATCH`: correção sem quebra de contrato.

## Deprecação

Uma versão pode ser marcada como deprecated em `meta.json`, com `since`, `reason` e, opcionalmente, `successor`.

`successor` pode ser:

- uma string legada como `erp-core/2.0.0`;
- um objeto com `name`, `version`, `guide`, `notes` e `codemod.path`.

O CLI mostra esse aviso em `list`, `info` e `fc`, e `cullet migrate <kit>@<versão>` usa esse bloco para imprimir ou executar o caminho de migração codificado.

## Referência completa

As regras operacionais completas continuam em [kits/VERSIONING.md](https://github.com/fabiano-eduardo/cullet/blob/main/kits/VERSIONING.md).
