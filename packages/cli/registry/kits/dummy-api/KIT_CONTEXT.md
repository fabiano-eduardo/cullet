# dummy-api — KIT_CONTEXT

## [purpose] Propósito

Kit de exemplo mínimo do cullet: um esqueleto de core em clean architecture (camadas `domain`, `application`, `errors` e `result`) que serve de referência de estrutura para começar um novo kit. Não expõe uma API de negócio própria — é o ponto de partida estrutural, não um kit de produção.

## [layers] Camadas

- **`domain/`** — modelo de negócio puro. Sem dependência de runtime externo. Invariantes lançam exceções tipadas.
- **`exceptions/`** — hierarquia de exceções de domínio derivadas de `DomainException`.
- **`errors/`** — `AppError` e descendentes para a camada de aplicação. Carregam `code` discriminado.
- **`result/`** — `Result<T, E>` para retorno tipado da aplicação.
- **`application/`** — `UseCase` base, `commands/`, `queries/`, `ports/`. Casos de uso consomem portas e retornam `Result`.

## [key-decisions] Decisões-chave

- **Domínio lança, aplicação retorna `Result`, infra traduz.**
- **Sem lib de log/observabilidade no runtime.** Portas vivem em `application/ports/`; adapters são opt-in.
- **Validação na borda**, uma única vez; tipo carrega a garantia depois.

## [extension-points] Pontos de extensão

Implemente as portas em `application/ports/` para conectar a stack real:

- `LoggerPort`, `MetricsPort`, `TracerPort` — observabilidade.
- Repositórios específicos do seu domínio, sempre com verbo mínimo.

## [non-goals] Não-objetivos

- **Não é ORM.** Nenhuma mágica de mapeamento, nenhum decorator de persistência.
- **Não é framework HTTP.** Não fornece controllers, roteamento, middleware.
- **Não é um kit de produção.** É um exemplo de estrutura; não traz primitives de negócio prontas para uso.
