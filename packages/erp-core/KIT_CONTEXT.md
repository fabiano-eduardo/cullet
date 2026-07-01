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
- **`rbac/`** — RBAC puro e zod-free: `Permission`/`Role`/`Grant`/`Scope`, o decisor `RbacAuthorizer` e a `AuthorizerPort`; subpath dedicado `./rbac`.
- **`versioning/`** — utilidades de versionamento de agregados temporais.

## [key-decisions] Decisões-chave

- **Domínio lança, aplicação retorna `Result`, infra traduz.** Não há `Result` no domínio.
- **Sem lib de log/observabilidade no runtime.** Portas vivem em `application/ports/`; adapters são opt-in.
- **Temporalidade interna ao kit** — suporte temporal no código-base, mas a API pública não publica `Timeline<T>` nem helpers temporais no barrel raiz.
- **Policies como dados**, não como if-statements: avaliáveis, compostas, serializáveis.
- **Policies permitem disable sem remover código**: `PolicyDefinition` aceita `enabled: false` e o repositório ignora definições desabilitadas.
- **Composição isolada é de primeira classe**: use `new CoreConfig()`, `new ContextResolverRegistry()` e `registerNamespacedContextResolversIn(...)` quando precisar evitar singletons compartilhados.
- **`Repository` vs `ResultRepository`**: `Repository` (`save`/`delete` → `Promise<void>`) é o estilo imperativo; `ResultRepository` devolve `Result` para sinalizar not-found / concorrência otimista sem quebrar o fluxo. Exemplo end-to-end (Command + ResultRepository + PolicyPort) compilado e testado em `src/examples/application/cancel-order.example.ts` (+ `.spec.ts`).

## [extension-points] Pontos de extensão

Implemente as portas em `application/ports/` para conectar a stack real:

- `LoggerPort`, `MetricsPort`, `TracerPort` — observabilidade.
- Repositórios específicos do seu domínio, sempre com verbo mínimo.
- `AuthorizerPort` (RBAC) / `AuthenticatorPort` quando aplicável.

## [non-goals] Não-objetivos

- **Não é ORM.** Nenhuma mágica de mapeamento, nenhum decorator de persistência.
- **Não é framework HTTP.** Não fornece controllers, roteamento, middleware.
- **Não é runtime de workflow.** Sagas, schedulers, filas: fora do escopo — devem ser kits separados.
- **Não impõe stack de teste.** As specs usam Vitest aqui, mas o desenho não depende disso.
