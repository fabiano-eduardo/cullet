---
title: erp-core
description: Kit de referência do catálogo para domínio transacional, policies e temporalidade.
---

`erp-core` é o kit mais completo do catálogo hoje. Ele existe para domínios ERP e outros cenários transacionais em que invariantes, policies e histórico temporal importam.

## O que entrega

- `Entity`, `ValueObject`, `RuleSet` e `Timeline` para modelagem de domínio.
- Exceções de domínio e `AppError` discriminado para a camada de aplicação.
- `Result<T, E>` e `Outcome` para retorno tipado.
- Base de `UseCase`, `commands`, `queries` e `ports`.
- Contratos de observabilidade em `core/application/ports/`.

## Decisões do kit

- Modelo de erro `mixed`: domínio lança exceções tipadas, aplicação retorna `Result`, infra traduz antes de cruzar a fronteira.
- Policies tratadas como dados serializáveis, não como `if` espalhado.
- Observabilidade apenas por portas; nenhuma lib de log/trace entra no runtime do kit.

## Como consumir

```ts
import {
  Entity,
  RuleSet,
  Timeline,
  ValueObject,
  allow,
  deny,
} from "cullet/erp-core";
```

Para pinar uma versão específica:

```ts
import { Timeline } from "cullet/erp-core/1.0.0";
```

## Leitura completa

Veja o README do kit em [packages/erp-core/README.md](https://github.com/fabiano-eduardo/cullet/blob/main/packages/erp-core/README.md).
