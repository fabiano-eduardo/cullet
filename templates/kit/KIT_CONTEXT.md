# **KIT_NAME** — KIT_CONTEXT

## [purpose] Propósito

**KIT_DESCRIPTION**

Uma frase mais específica do problema-alvo deve substituir a descrição padrão acima antes da primeira release.

## [layers] Camadas

Descreva como o `src/` deste kit está organizado e a responsabilidade de cada fronteira (camadas, módulos, slices — o que o paradigma do kit usar). `cullet` não impõe arquitetura; substitua o exemplo abaixo pela estrutura real antes da primeira release.

Exemplo para um kit organizado em **camadas** (uma das opções; um kit de frontend ou SDK descreveria outras fronteiras):

- **`core/domain/`** — modelo de negócio puro, sem runtime externo; invariantes lançam exceções tipadas.
- **`core/application/`** — `UseCase`, `commands/`, `queries/`, `ports/`; casos de uso consomem portas e retornam `Result`.
- **`core/errors/`**, **`core/exceptions/`**, **`core/result/`** — erro de aplicação, exceção de domínio e tipo de retorno.

## [key-decisions] Decisões-chave

Liste as decisões que não devem ser rediscutidas a cada mudança — incluindo qual regra estrutural o kit liga em `meta.json -> lint`, se houver. Exemplos comuns:

- **Falha previsível volta como `Result`; invariante lança exceção tipada; integração externa traduz.**
- **Sem lib de log/observabilidade no runtime.** A observabilidade é exposta só por contratos injetáveis; implementações são opt-in.
- **Validação na borda**, uma única vez; tipo carrega a garantia depois.

## [extension-points] Pontos de extensão

Descreva onde o kit aceita extensão sem quebrar sua estrutura — quais contratos o consumidor implementa para plugar o kit numa stack real:

- `LoggerPort`, `MetricsPort`, `TracerPort` — observabilidade (quando o kit a produz).
- Contratos específicos do kit, sempre com o menor verbo necessário.

## [non-goals] Não-objetivos

- **Não é ORM.** Nenhuma mágica de mapeamento, nenhum decorator de persistência.
- **Não é framework HTTP.** Não fornece controllers, roteamento, middleware.
- Substitua esta lista pelos não-objetivos reais do kit antes da release.
