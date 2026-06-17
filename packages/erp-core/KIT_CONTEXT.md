# erp-core — KIT_CONTEXT

## [purpose] Propósito

Núcleo arquitetural para sistemas ERP (e domínios transacionais com temporalidade). Resolve o problema de começar um core de negócio com entidades, value objects, policies, tratamento de erros e services de aplicação já desenhados em clean architecture, sem amarrar a framework.

## [layers] Camadas

- **`domain/`** — `Entity`, `ValueObject`. Pura: zero dependência de runtime externo. Invariantes lançam exceções tipadas.
- **`exceptions/`** — hierarquia de exceções de domínio (`DomainException`, `InvariantViolationException`, `InvalidStateTransitionException`, `ValidationException`, `BusinessRuleViolationException`, `EntityNotFoundException`).
- **`errors/`** — erros de aplicação (`AppError` e descendentes: `ValidationError`, `NotFoundError`, `ConflictError`, `AuthorizationError`, `IntegrationError`, etc.). Carregam `code` discriminado.
- **`result/`** — `Result<T, E>` e `Outcome` para retorno tipado da camada de aplicação.
- **`application/`** — `UseCase` base, `commands/`, `queries/`, `ports/`. Casos de uso consomem portas e retornam `Result`.
- **`policies/`** — catálogo, definições, resolução e avaliação de policies declarativas.
- **`versioning/`** — utilidades de versionamento de agregados temporais.

## [key-decisions] Decisões-chave

- **Domínio lança, aplicação retorna `Result`, infra traduz.** Não há `Result` no domínio.
- **Sem lib de log/observabilidade no runtime.** Portas vivem em `application/ports/`; adapters são opt-in.
- **Temporalidade interna ao kit** — o kit mantém suporte temporal no código-base, mas a API pública principal nao publica um `Timeline<T>` nem helpers temporais dedicados no barrel raiz.
- **Policies como dados**, não como if-statements: avaliáveis, compostas, serializáveis.
- **Policies permitem disable sem remover código**: `PolicyDefinition` aceita `enabled: false` e o repositório ignora definições desabilitadas.
- **Composição isolada é de primeira classe**: use `new CoreConfig()`, `new ContextResolverRegistry()` e `registerNamespacedContextResolversIn(...)` quando precisar evitar singletons compartilhados.

## [example] Exemplo end-to-end (Command + Repository + PolicyPort)

Um `Command` carrega o agregado por um `ResultRepository`, consulta um
`PolicyPort` (gate `ALLOW`/`DENY`) e persiste. Falhas recuperáveis voltam como
`Result.err`, nunca como exceção.

```ts
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

    protected async execute(input: CancelOrderInput) {
        const found = await this.orders.findById(input.orderId);
        if (found.isErr()) return found;
        const order = found.getOrThrow();
        if (!order)
            return Result.err(
                new NotFoundError("Order", { id: input.orderId }),
            );

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
                    policyId: result.ref.definitionId,
                    policyVersion: Number(result.ref.policyVersion),
                    evaluatedAtIso: result.evaluatedAt.toISOString(),
                }),
            );
        }

        const saved = await this.orders.save({ ...order, status: "CANCELLED" });
        if (saved.isErr()) return saved;
        return Result.ok({ ...order, status: "CANCELLED" });
    }
}
```

- **Imports**: tudo do root `@cullet/erp-core`.
- **`Repository` vs `ResultRepository`**: `Repository` (`save`/`delete` → `Promise<void>`) é o estilo imperativo; `ResultRepository` devolve `Result` para sinalizar not-found / concorrência otimista sem quebrar o fluxo.
- **Referência compilada/testada**: `src/examples/application/cancel-order.example.ts` (+ `.spec.ts`).

## [extension-points] Pontos de extensão

Implemente as portas em `application/ports/` para conectar a stack real:

- `LoggerPort`, `MetricsPort`, `TracerPort` — observabilidade.
- Repositórios específicos do seu domínio, sempre com verbo mínimo.
- `AuthorizerPort` / `AuthenticatorPort` quando aplicável.

## [non-goals] Não-objetivos

- **Não é ORM.** Nenhuma mágica de mapeamento, nenhum decorator de persistência.
- **Não é framework HTTP.** Não fornece controllers, roteamento, middleware.
- **Não é runtime de workflow.** Sagas, schedulers, filas: fora do escopo — devem ser kits separados.
- **Não impõe stack de teste.** As specs usam Vitest aqui, mas o desenho não depende disso.
