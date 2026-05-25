# dummy-api — KIT_CONTEXT

## Propósito

Kit dummy de API para validar o fluxo de criacao

Uma frase mais específica do problema-alvo deve substituir a descrição padrão acima antes da primeira release.

## Camadas

- **`domain/`** — modelo de negócio puro. Sem dependência de runtime externo. Invariantes lançam exceções tipadas.
- **`exceptions/`** — hierarquia de exceções de domínio derivadas de `DomainException`.
- **`errors/`** — `AppError` e descendentes para a camada de aplicação. Carregam `code` discriminado.
- **`result/`** — `Result<T, E>` para retorno tipado da aplicação.
- **`application/`** — `UseCase` base, `commands/`, `queries/`, `ports/`. Casos de uso consomem portas e retornam `Result`.

## Decisões-chave

- **Domínio lança, aplicação retorna `Result`, infra traduz.**
- **Sem lib de log/observabilidade no runtime.** Portas vivem em `application/ports/`; adapters são opt-in.
- **Validação na borda**, uma única vez; tipo carrega a garantia depois.

## Pontos de extensão

Implemente as portas em `application/ports/` para conectar a stack real:

- `LoggerPort`, `MetricsPort`, `TracerPort` — observabilidade.
- Repositórios específicos do seu domínio, sempre com verbo mínimo.

## Não-objetivos

- **Não é ORM.** Nenhuma mágica de mapeamento, nenhum decorator de persistência.
- **Não é framework HTTP.** Não fornece controllers, roteamento, middleware.
- Substitua esta lista pelos não-objetivos reais do kit antes da release.
