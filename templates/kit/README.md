# __KIT_NAME__

__KIT_DESCRIPTION__

Para o sumário prompt-friendly do kit veja [`KIT_CONTEXT.md`](./KIT_CONTEXT.md). Para os contratos comuns a todos os kits veja a [`PHILOSOPHY.md`](../../../../PHILOSOPHY.md) do repositório.

---

## O que entrega

Substitua esta seção pela descrição concreta do que vem dentro do kit:

- principais primitives expostas em `index.ts`
- camadas de `core/` que existem (e o que cada uma resolve)
- limites: o que está pronto, o que é só esqueleto

## Como começa

```ts
import { /* primitives */ } from "cullet/__KIT_NAME__";
```

Versão pinada (recomendado em produção):

```ts
import { /* primitives */ } from "cullet/__KIT_NAME__/1.0.0";
```

Se preferir o modo full-control:

```bash
npx cullet fc __KIT_NAME__@1.0.0
```

O comando copia o kit para `./cullet/__KIT_NAME__@1.0.0/` e registra o alias `cullet/__KIT_NAME__` no seu `tsconfig.json`.

## Decisões tomadas

- **Modelo de erro**: `mixed` — domínio lança exceções tipadas; aplicação retorna `Result<T, AppError>`; infra traduz para `Result`.
- **Observabilidade**: somente via portas (`LoggerPort`, `MetricsPort`, `TracerPort`). Sem dependência runtime de lib de log/trace.
- **Validação**: entrada externa validada uma única vez na borda; o domínio assume input já válido em tipo.
- Adicione aqui as decisões específicas deste kit (escolhas de schema, convenções de naming, opções deliberadamente excluídas).

## Como evoluir

- **Novos casos de uso**: crie em `core/application/` consumindo portas existentes; nunca import de `adapters/` dentro de `application/`.
- **Adicionar uma porta**: crie a interface em `core/application/ports/`, implemente em `adapters/<sua-lib>/`, e mantenha a porta livre de tipos de runtime externo.
- **Mudança incompatível**: abra uma nova versão (`versions/2.0.0/`). Regras completas em [`kits/VERSIONING.md`](../../../../kits/VERSIONING.md).
- **Antes de publicar**: rode `npm run validate-kits` para garantir que o kit ainda respeita a filosofia.
