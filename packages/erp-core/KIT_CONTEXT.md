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
- **`rbac/`** — RBAC zod-free (`./rbac`): `Permission`/`Role`/`Grant`/`Scope`, decisor `RbacAuthorizer`, `AuthorizerPort`.
- **`abac/`** — ABAC zod-free (`./abac`): `AbacRule`/`AbacPolicySet` + combinação, decisor `AbacAuthorizer`, `AbacAuthorizerPort`, `CompositeAuthorizer`.
- **`versioning/`** — utilidades de versionamento de agregados temporais.

## [key-decisions] Decisões-chave

- **Domínio lança, aplicação retorna `Result`, infra traduz.** Não há `Result` no domínio.
- **Sem lib de log/observabilidade no runtime.** Portas vivem em `application/ports/`; adapters são opt-in.
- **Temporalidade fora do barrel raiz** — o barrel raiz não publica `Timeline<T>` nem helpers temporais; as primitivas bitemporais (`createValidTime`, `createTemporalSnapshot`, ranges) são publicadas apenas no subpath `./domain`, porque a porta pública `TemporalRepository` expõe `TemporalSnapshot` e quem a implementa precisa das factories validantes.
- **Policies como dados**, não como if-statements: avaliáveis, compostas, serializáveis.
- **Policies permitem disable sem remover código**: `PolicyDefinition` aceita `enabled: false` e o repositório ignora definições desabilitadas.
- **Composição isolada é de primeira classe**: use `new CoreConfig()`, `new ContextResolverRegistry()` e `registerNamespacedContextResolversIn(...)` quando precisar evitar singletons compartilhados.
- **`Repository` vs `ResultRepository`**: `Repository` (`save`/`delete` → `Promise<void>`) é o estilo imperativo; `ResultRepository` devolve `Result` para sinalizar not-found / concorrência otimista sem quebrar o fluxo. Exemplo end-to-end (Command + ResultRepository + PolicyPort) compilado e testado em `src/examples/application/cancel-order.example.ts` (+ `.spec.ts`).

## [extension-points] Pontos de extensão

Implemente as portas em `application/ports/` para conectar a stack real:

- `LoggerPort`, `MetricsPort`, `TracerPort` — observabilidade.
- Repositórios do seu domínio, sempre com verbo mínimo.
- `AuthorizerPort`/`AbacAuthorizerPort`/`AuthenticatorPort`.

## [known-limits] Limitações conhecidas

- **Dois registries são estado global de processo** (a promessa "composição sem singletons" não os cobre): `GatePayloadParsers` (parsers de payload gate) e `ValueObject.plugins` (plugin de igualdade) valem para o processo inteiro — hosts multi-tenant no mesmo processo compartilham esses registros mesmo usando `CoreConfig`/registries isolados.
- **ABAC é fail-closed por regra não-avaliável** (atributo ausente = erro que nega o set inteiro com `forbidden`, atribuído à regra culpada). Válvula de escape: `AbacPolicySet.of(rules, { onEvaluationError: "skip-rule" })` descarta a regra não-avaliável. `isNull`/`isNotNull` testam `null` explícito, não chave ausente. Decisões (PERMIT/DENY) saem como evento `abac-decision` no reporter (silencioso por padrão). Detalhe completo no JSDoc de `AbacRule`.
- **`Date` aninhado em `ValueObject` não é congelável** (`Object.freeze` não bloqueia `setTime`): o clone protege do caller, mas quem lê `value` consegue mutar o `Date` interno. Prefira ISO string/timestamp no estado do VO.

## [non-goals] Não-objetivos

- **Não é ORM.** Nenhuma mágica de mapeamento, nenhum decorator de persistência.
- **Não é framework HTTP.** Não fornece controllers, roteamento, middleware.
- **Não é runtime de workflow.** Sagas, schedulers, filas: fora do escopo — devem ser kits separados.
- **Não impõe stack de teste.** As specs usam Vitest aqui, mas o desenho não depende disso.
