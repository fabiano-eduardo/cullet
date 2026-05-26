---
title: Versionamento
description: Como o cullet versiona pacote e kits sem quebrar consumidores existentes.
---

`cullet` tem dois níveis de versão:

- O pacote npm `cullet`, definido em `package.json`.
- Cada kit individual, definido em `kits/<nome>/versions/<x.y.z>/meta.json` e refletido em `registry/index.json`.

## Regras principais

- SemVer é aplicado ao kit, não apenas ao pacote.
- Versões publicadas de kit são imutáveis; correção é sempre uma nova versão, nunca reescrita da pasta antiga.
- `cullet/<nome>` resolve para a `latest` do kit.
- `cullet/<nome>/<versão>` fixa o consumo em uma versão exata.

## Quando abrir nova pasta de versão

- `MAJOR`: mudança incompatível na superfície pública do kit.
- `MINOR`: adição compatível de API ou capacidade.
- `PATCH`: correção sem quebra de contrato.

## Deprecação

Uma versão pode ser marcada como deprecated em `meta.json`, com `since`, `reason` e, opcionalmente, `successor`. O CLI passa a mostrar esse aviso em `list`, `info` e `fc`, mas a versão continua disponível.

## Referência completa

As regras operacionais completas continuam em [kits/VERSIONING.md](https://github.com/fabiano-eduardo/cullet/blob/main/kits/VERSIONING.md).