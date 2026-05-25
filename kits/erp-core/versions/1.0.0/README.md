# erp-core

Núcleo arquitetural para sistemas ERP e domínios transacionais com temporalidade. Primitives tipadas (entidades, value objects, rule sets, policies, timeline) com clean architecture pronta para receber adapters.

Para o sumário prompt-friendly veja [`KIT_CONTEXT.md`](./KIT_CONTEXT.md). Para os contratos comuns a todos os kits veja a [`PHILOSOPHY.md`](../../../../PHILOSOPHY.md).

---

## O que entrega

- **Domínio** — `Entity`, `ValueObject`, `RuleSet`, `Timeline` (temporalidade nativa).
- **Exceções de domínio** — `DomainException`, `InvariantViolationException`, `InvalidStateTransitionException`, `ValidationException`, `BusinessRuleViolationException`, `EntityNotFoundException`.
- **Erros de aplicação** — `AppError` discriminada por `code`: `ValidationError`, `NotFoundError`, `ConflictError`, `AuthorizationError`, `IntegrationError`.
- **Result** — `Result<T, E>` e `Outcome` para retorno tipado da aplicação.
- **Policies** — engine declarativa (`allow`/`deny`) com schema de condições, composta e serializável.
- **Application** — `UseCase` base, slots para `commands/`, `queries/`, `ports/`.

## Como começa

Import direto (sempre a versão `latest` exportada pelo pacote):

```ts
import {
  Entity,
  ValueObject,
  RuleSet,
  Timeline,
  allow,
  deny,
  type Policy,
} from "cullet/erp-core";
```

Pinado em uma versão (recomendado em produção):

```ts
import { Timeline } from "cullet/erp-core/1.0.0";
```

Full-control (kit copiado para dentro do projeto, livre para editar):

```bash
npx cullet fc erp-core@1.0.0
```

## Decisões tomadas

- **Modelo de erro `mixed`**: domínio lança `DomainException`, aplicação retorna `Result<T, AppError>`, infra traduz para `Result`. Não cruze a fronteira.
- **Temporalidade nativa**: variação de valor no tempo modelada por `Timeline<T>` — sem campos soltos `validFrom`/`validTo`.
- **Policies como dados**: avaliáveis, compostas, serializáveis. Não são `if`s espalhados pela aplicação.
- **Observabilidade só via portas**: `LoggerPort`, `MetricsPort`, `TracerPort` em `core/application/ports/`. Sem dependência runtime de `pino`, `winston`, OpenTelemetry no kit.
- **Dependência runtime declarada**: `zod` (validação tipada). Em modo full-control, instale manualmente — o `cullet doctor` e o `cullet fc` te avisam.

## Como evoluir

- **Novos use cases**: criar em `core/application/` consumindo portas existentes; nunca importar de `adapters/`.
- **Novas portas**: interface em `core/application/ports/`, implementação em `adapters/<lib>/`, sem vazar tipos da lib externa.
- **Novas exceções de domínio**: derive de `DomainException` em `core/exceptions/`.
- **Novos erros de aplicação**: derive de `AppError` e adicione o `code` discriminado em `core/errors/`.
- **Mudança incompatível**: abra `versions/2.0.0/`. Regras em [`kits/VERSIONING.md`](../../../../kits/VERSIONING.md).
- **Antes de publicar**: `npm run validate-kits` para garantir aderência à filosofia.
