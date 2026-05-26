---
title: dummy-api
description: Sandbox do pipeline de criação e validação de kits do catálogo.
---

`dummy-api` não é um kit de produção. Ele existe para validar o fluxo inteiro do catálogo: scaffold, metadados, README, `KIT_CONTEXT.md`, build e publicação.

## O que entrega

- Estrutura mínima de `core/domain`, `core/application`, `core/errors`, `core/exceptions` e `core/result`.
- `meta.json`, `README.md` e `KIT_CONTEXT.md` válidos contra o schema.
- Um alvo simples para regressões no `new-kit` e no `validate-kits`.

## Quando olhar para ele

- Quando quiser ver o formato mínimo de um kit antes de escrever um kit real.
- Quando estiver mexendo no pipeline de scaffold ou nas regras do validador.

## Leitura completa

Veja o README do kit em [kits/dummy-api/versions/1.0.0/README.md](https://github.com/fabiano-eduardo/cullet/blob/main/kits/dummy-api/versions/1.0.0/README.md).