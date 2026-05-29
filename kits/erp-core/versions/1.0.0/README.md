# erp-core

Núcleo arquitetural para sistemas ERP e domínios transacionais. Primitives tipadas para domínio, policies, erros e application services com clean architecture pronta para receber adapters.

Para o sumário prompt-friendly veja [`KIT_CONTEXT.md`](./KIT_CONTEXT.md). Para os contratos comuns a todos os kits veja a [`PHILOSOPHY.md`](../../../../PHILOSOPHY.md).

---

## O que entrega

- **Domínio** — `Entity`, `ValueObject`.
- **Exceções de domínio** — `DomainException`, `InvariantViolationException`, `InvalidStateTransitionException`, `ValidationException`, `BusinessRuleViolationException`, `EntityNotFoundException`.
- **Erros de aplicação** — `AppError` discriminada por `code`: `ValidationError`, `NotFoundError`, `ConflictError`, `AuthorizationError`, `IntegrationError`.
- **Result** — `Result<T, E>` e `Outcome` para retorno tipado da aplicação.
- **Policies** — `PolicyCatalog`, `PolicyDefinition`, `PolicyResolver`, `PolicyService` e tipos associados para avaliação declarativa.
- **Application** — portas de observabilidade (`LoggerPort`, `MetricsPort`, `TracerPort`) e `mapPolicyEvaluationError` para integrar a camada de aplicação.
- **Exemplos** — rulesets de referência em `examples/rulesets/`, fora da superfície principal de domínio.

## Como começa

Import direto (sempre a versão `latest` exportada pelo pacote):

```ts
import {
  Entity,
  ValueObject,
  PolicyCatalog,
  PolicyService,
  mapPolicyEvaluationError,
  type PolicyDecision,
} from "cullet/erp-core";
```

Pinado em uma versão (recomendado em produção):

```ts
import { PolicyResolver } from "cullet/erp-core/1.0.0";
```

Full-control (kit copiado para dentro do projeto, livre para editar):

```bash
npx cullet fc erp-core@1.0.0
```

## Composicao sem singletons

Para isolamento por tenant, request ou teste, prefira instancias locais em vez
dos exports globais `coreConfig` e `contextResolverRegistry`:

```ts
import {
  ComputeRegistry,
  ContextResolverRegistry,
  CoreConfig,
  GateEngineRegistry,
  PolicyContextBuilder,
  Result,
  registerNamespacedContextResolversIn,
} from "cullet/erp-core";
import { GateEngineV1 } from "cullet/erp-core/policies/engines/v1/gate";

const coreConfig = new CoreConfig({
  observability: { reporter },
});

const resolverRegistry = new ContextResolverRegistry();
registerNamespacedContextResolversIn(resolverRegistry, "billing", [
  {
    path: "student.contractStatus",
    resilience: {
      timeoutMs: 200,
      retry: { maxAttempts: 3, initialDelayMs: 25, maxDelayMs: 100 },
      circuitBreaker: { failureThreshold: 5, cooldownMs: 1_000 },
    },
    async resolve(seed) {
      return Result.ok(seed.fields.contractStatus);
    },
  },
]);

const contextBuilder = new PolicyContextBuilder(resolverRegistry);

const gateEngines = new GateEngineRegistry();
gateEngines.register(new GateEngineV1({ coreConfig }));

const computeRegistry = new ComputeRegistry({ coreConfig });
```

Os singletons continuam disponiveis para apps simples, mas nao sao o caminho
recomendado quando ha risco de bleed entre composicoes concorrentes.

## Decisões tomadas

- **Modelo de erro `mixed`**: domínio lança `DomainException`, aplicação retorna `Result<T, AppError>`, infra traduz para `Result`. Não cruze a fronteira.
- **Temporalidade interna ao kit**: o suporte temporal continua no código do kit, mas a API pública principal não expõe um container `Timeline<T>` nem helpers temporais dedicados no barrel raiz.
- **Policies como dados**: catalogadas, resolvidas e avaliadas por `PolicyCatalog`, `PolicyResolver` e `PolicyService`. Não são `if`s espalhados pela aplicação.
- **Disable first-class para definitions**: `PolicyDefinition` aceita `enabled: false` para desligar uma definicao sem removê-la do repositório; o default continua `true`.
- **Observabilidade só via portas**: `LoggerPort`, `MetricsPort`, `TracerPort` em `core/application/ports/`. Sem dependência runtime de `pino`, `winston`, OpenTelemetry no kit.
- **Dependência runtime declarada**: `zod` (validação tipada). Em modo full-control, instale manualmente — o `cullet doctor` e o `cullet fc` te avisam.

## Como evoluir

- **Novos use cases**: criar em `core/application/` consumindo portas existentes; nunca importar de `adapters/`.
- **Novas portas**: interface em `core/application/ports/`, implementação em `adapters/<lib>/`, sem vazar tipos da lib externa.
- **Novas exceções de domínio**: derive de `DomainException` em `core/exceptions/`.
- **Novos erros de aplicação**: derive de `AppError` e adicione o `code` discriminado em `core/errors/`.
- **Mudança incompatível**: abra `versions/2.0.0/`. Regras em [`kits/VERSIONING.md`](../../../../kits/VERSIONING.md).
- **Antes de publicar**: `npm run validate-kits` para garantir aderência à filosofia.
