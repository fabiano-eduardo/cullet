# erp-core

Núcleo arquitetural para sistemas ERP e domínios transacionais. Primitives tipadas para domínio, policies, erros e application services com clean architecture pronta para receber adapters.

Para o sumário prompt-friendly veja [`KIT_CONTEXT.md`](./KIT_CONTEXT.md). Para os contratos comuns a todos os kits veja a [`PHILOSOPHY.md`](../../PHILOSOPHY.md).

---

## O que entrega

- **Domínio** — `Entity`, `ValueObject`.
- **Exceções de domínio** — `DomainException`, `InvariantViolationException`, `InvalidStateTransitionException`, `ValidationException`, `BusinessRuleViolationException`, `EntityNotFoundException`.
- **Erros de aplicação** — `AppError` discriminada por `code`: `ValidationError`, `NotFoundError`, `ConflictError`, `AuthorizationError`, `IntegrationError`.
- **Result** — `Result<T, E>` e `Outcome` para retorno tipado da aplicação.
- **Policies** — `PolicyCatalog`, `PolicyDefinition`, `PolicyResolver`, `PolicyService` e tipos associados para avaliação declarativa.
- **Application** — `UseCase`/`Command` (CQS, entrada `CommandInput` com `RequestedBy`), portas de persistência (`Repository` e a variante `ResultRepository`), `PolicyPort`, portas de observabilidade (`LoggerPort`, `MetricsPort`, `TracerPort`) e `mapPolicyEvaluationError`. Veja o [exemplo end-to-end](#exemplo-end-to-end).
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
} from "@cullet/erp-core";
```

Pinado em uma versão (recomendado em produção): fixe a versão npm do pacote no
seu `package.json` (ex.: `"@cullet/erp-core": "1.0.0"`).

```ts
import { PolicyResolver } from "@cullet/erp-core";
```

Full-control (kit copiado para dentro do projeto, livre para editar):

```bash
npx cullet fc erp-core@1.0.0
```

O argumento do `fc` é o nome do kit no registry (`erp-core`), não o nome npm com escopo. O comando instala `@cullet/erp-core`, copia o `src/` para `./cullet/erp-core@1.0.0/` e registra o alias `@cullet/erp-core` no `tsconfig.json`.

## Exemplo end-to-end

Um `Command` concreto que orquestra um `ResultRepository` e um `PolicyPort`.
O fluxo carrega o agregado, consulta uma policy declarativa (gate `ALLOW`/`DENY`)
e só então persiste — toda falha recuperável (erro de infra no repositório,
policy negando, agregado inexistente, conflito de concorrência otimista no
`save`) volta como `Result.err(...)`, nunca como exceção atravessando a
fronteira. O código abaixo é a versão consumidora do exemplo testado em
[`src/examples/application/cancel-order.example.ts`](./src/examples/application/cancel-order.example.ts).

```ts
import {
    AuthorizationError,
    Command,
    NotFoundError,
    RequestedBy,
    Result,
    asPolicyDecisionId,
    asSchoolId,
    asTenantId,
    type CommandInput,
    type PolicyPort,
    type ResultRepository,
} from "@cullet/erp-core";

type OrderStatus = "OPEN" | "CANCELLED";
interface Order {
    readonly id: string;
    readonly status: OrderStatus;
}

// `CommandInput` obriga toda mutação a registrar quem a disparou.
interface CancelOrderInput extends CommandInput {
    readonly orderId: string;
    readonly tenantId: string;
    readonly schoolId: string;
}

type CancelOrderError = NotFoundError | AuthorizationError;

class CancelOrder extends Command<
    CancelOrderInput,
    Result<Order, CancelOrderError>
> {
    constructor(
        private readonly orders: ResultRepository<
            Order,
            string,
            CancelOrderError
        >,
        private readonly policies: PolicyPort,
    ) {
        super();
    }

    protected async execute(
        input: CancelOrderInput,
    ): Promise<Result<Order, CancelOrderError>> {
        // 1. Carrega o agregado; falhas de infra ficam in-band no Result.
        const found = await this.orders.findById(input.orderId);
        if (found.isErr()) return found;

        const order = found.getOrThrow();
        if (!order) {
            return Result.err(
                new NotFoundError("Order", { id: input.orderId }),
            );
        }

        // 2. Decide via policy declarativa (um GATE retorna ALLOW/DENY).
        const evaluated = await this.policies.evaluate({
            decisionId: asPolicyDecisionId(input.orderId),
            policyKey: "order.cancel",
            scopeChain: [],
            contextVersion: 1,
            seed: {
                tenantId: asTenantId(input.tenantId),
                schoolId: asSchoolId(input.schoolId),
                fields: { orderStatus: order.status },
            },
        });
        if (evaluated.isErr()) return evaluated;

        const result = evaluated.getOrThrow();
        if (result.kind === "GATE" && result.decision.status === "DENY") {
            return Result.err(
                AuthorizationError.policyDenied({
                    action: "order.cancel",
                    resource: { type: "Order", id: order.id },
                    policyId: result.ref.definitionId,
                    policyVersion: Number(result.ref.policyVersion),
                    evaluatedAtIso: result.evaluatedAt.toISOString(),
                }),
            );
        }

        // 3. Muta e persiste; um conflito de versão no save também volta como
        //    Result.err — nunca uma exceção atravessando a fronteira.
        const cancelled: Order = { ...order, status: "CANCELLED" };
        const saved = await this.orders.save(cancelled);
        if (saved.isErr()) return saved;

        return Result.ok(cancelled);
    }
}

// Chamada — `run` recebe a entrada e devolve o Result tipado.
const result = await new CancelOrder(orderRepository, policyPort).run({
    orderId: "order-42",
    tenantId: "tenant-1",
    schoolId: "school-1",
    requestedBy: RequestedBy.fromUser("550e8400-e29b-41d4-a716-446655440000"),
});

result.match({
    ok: (order) => console.log("cancelado", order.id),
    err: (error) => console.error(error.code, error.message),
});
```

`Repository<TEntity, TId>` (estilo imperativo, `save`/`delete` retornam
`Promise<void>`) continua disponível quando você prefere lançar exceções;
`ResultRepository` é a variante alinhada à filosofia "erros como valor" e
permite sinalizar not-found / concorrência otimista sem quebrar o fluxo. Uma
implementação in-memory de referência está em
[`src/examples/application/in-memory-account-repository.example.ts`](./src/examples/application/in-memory-account-repository.example.ts).

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
} from "@cullet/erp-core";
import { GateEngineV1 } from "@cullet/erp-core/policies/engines/v1/gate";

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
- **Mudança incompatível**: evolua `src/` na branch da release e bumpe uma nova MAJOR (`2.0.0`) via changeset (`package.json`/`meta.json`). Regras em [`kits/VERSIONING.md`](../../kits/VERSIONING.md).
- **Antes de publicar**: `npm run validate-kits` para garantir aderência à filosofia.
