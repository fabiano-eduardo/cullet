# Filosofia do cullet

Este documento existe para tornar a "filosofia comum" do `cullet` um **artefato verificável**, não um valor declarado em README. Cada kit publicado neste repositório precisa aderir às regras abaixo. Quando um kit divergir, a divergência deve ser explícita no `KIT_CONTEXT.md` do próprio kit, com justificativa.

Checklist operacional, buckets A/B/C e revisão humana obrigatória vivem em `CONTRIBUTING-KIT.md`.

Esta filosofia é o critério de curadoria. Se um kit não a respeita, não é cullet.

---

## 1. Erros

### Hierarquia explícita

Todo kit reconhece três classes de erro, e nenhuma outra:

- **Erro de domínio** — invariante de negócio violada, transição de estado inválida, regra de negócio quebrada. Vive em `core/exceptions/` ou equivalente. Nunca depende de runtime, rede, ou framework. É a única classe que o domínio pode lançar.
- **Erro de aplicação** — caso de uso recusado por motivo conhecido: não-encontrado, conflito, autorização negada, idempotência violada, entrada inválida na borda. Vive em `core/errors/` e implementa `AppError`.
- **Erro de infraestrutura** — falha de I/O, integração externa, serialização, dependência indisponível. Sempre encapsulado em `IntegrationError` (ou equivalente) antes de cruzar a fronteira do adapter. Stack trace original preservado em `cause`.

A regra é: **erro de domínio é lançado, erro de aplicação é retornado, erro de infraestrutura é traduzido**.

### Nunca capturar para esconder

`catch` sem rethrow, log, ou conversão tipada é proibido. Toda captura precisa terminar em uma de três coisas:

1. Rethrow (eventualmente envelopado em uma classe da hierarquia acima).
2. Conversão para `Result.fail(...)` com erro tipado.
3. Log estruturado **mais** rethrow — nunca log puro que engole.

`catch (_)` que descarta o erro é um defeito, não um estilo.

### Convenção: `Result<T, E>` para aplicação, exceções tipadas para domínio

Escolha tomada e fixa para todo o catálogo:

- **Camada de domínio** usa **exceções tipadas** (`DomainException` e descendentes). Invariantes não são caminhos felizes — sinalizam bug ou estado impossível, e devem interromper o fluxo. Forçar `Result` aqui mascara invariantes como erros recuperáveis.
- **Camada de aplicação** usa **`Result<T, E>`** (`core/result/result.ts`). Casos de uso falham de formas previsíveis; o chamador precisa enxergar isso no tipo.
- **Camada de infraestrutura** pode lançar internamente, mas **expõe `Result`** para a aplicação. A tradução é responsabilidade do adapter, não do caller.

Não há terceira via. Kits novos seguem essa divisão.

---

## 2. Observabilidade

Cada kit DEVE expor três superfícies de observabilidade, todas via **portas** — nunca acopladas a uma lib específica.

### Logs estruturados

- Porta `LoggerPort` (ou equivalente) com níveis `debug | info | warn | error` e payload tipado como `Record<string, unknown>`.
- Mensagens em inglês, snake_case nas chaves. Sem string interpolation no `message` — contexto vai no payload.
- O kit nunca importa `pino`, `winston`, `bunyan`, `console`. Adapters opcionais ficam em `adapters/` e são publicados separadamente ou copiados via full-control.

### Métricas

- Porta `MetricsPort` com `counter`, `gauge`, `histogram`. Nomes em `snake_case` com namespace do kit (ex.: `erp_core_use_case_duration_ms`).
- Cardinalidade controlada na porta: labels declarados no contrato, não livres.

### Tracing

- Porta `TracerPort` compatível com a forma do OpenTelemetry (`startSpan`, `setAttribute`, `end`, `recordException`) — sem importar `@opentelemetry/*`.
- Cada use case roda dentro de um span. Erros de aplicação viram `span.setStatus({ code: ERROR })`; erros de domínio também.

---

## 3. Testes

### Camadas obrigatoriamente testáveis sem mocks pesados

- **Domínio** (`core/domain/`, `core/exceptions/`, `core/policies/`) — testado **sem nenhum mock**. Se um teste de domínio precisa mockar I/O, o domínio está acoplado a infra. Bug de design, não de teste.
- **Aplicação** (`core/application/`) — testado com **stubs in-memory das portas**. Não usa `jest.mock`, `vi.mock`, ou mocking de módulo. Stubs são objetos tipados que implementam a porta — vivem em `test/stubs/` quando reusados.
- **Adapters** (`adapters/*`) — testados contra o serviço real (Postgres real, Redis real) via testcontainers ou ambiente local. Mocks aqui não provam nada.

Regra-mãe: **core não depende de infra mockada**. Se você precisa mockar para testar o core, o core está errado.

### Nomenclatura

- `*.spec.ts` ao lado do arquivo testado. Nada de pasta `__tests__/` paralela.
- Bloco raiz: `describe("ClassName" | "functionName", ...)`.
- Casos: `it("does X when Y", ...)` — descrição em inglês, voz ativa, sem "should".

### Organização

- Um arquivo de teste por unidade pública. Helpers de teste em `*.test-helpers.ts` (não `.spec.ts` para o runner não recolher).
- Fixtures complexas em `test/fixtures/`.

---

## 4. Resiliência

A divisão é estrita: **portas decidem, adapters implementam**.

### Quem decide (ports / aplicação)

- **Timeouts** — todo caso de uso que cruza um boundary declara `timeoutMs` no contrato da porta. Sem timeout default escondido no adapter.
- **Retries** — política declarada na porta (`RetryPolicy { maxAttempts, backoff }`). O caso de uso decide se retry faz sentido para aquele fluxo (idempotente? recuperável?).
- **Idempotência** — chave de idempotência é parâmetro do comando, não responsabilidade do adapter. O domínio define que comandos são idempotentes; a aplicação garante a chave.
- **Circuit breaker** — estado e thresholds expostos via porta `CircuitBreakerPort`. O caso de uso pergunta "posso chamar?", não o adapter.

### Quem implementa (adapters)

- Adapters traduzem a política em chamadas concretas (`AbortController` para timeout, lib específica para retry, Redis para idempotency key store, etc.).
- Adapter nunca decide política. Se o adapter tem retry hardcoded, vaza acoplamento.

---

## 5. Segurança

### Validação na borda

- Entrada externa (HTTP, fila, CLI) é validada **uma vez**, na entrada do adapter, contra um schema tipado. A partir daí, o tipo carrega a garantia — nada de revalidar no use case.
- Validação retorna `Result.fail(ValidationError)`, nunca lança.
- Domínio assume input válido em tipo. Se um value object precisa rejeitar valor, é invariante (lança), não validação (retorna).

### Ports para authz/authn

- **Authn** — porta `AuthenticatorPort` resolve credencial em principal. Sempre uma porta, nunca um middleware acoplado.
- **Authz** — porta `AuthorizerPort` (ou policies de domínio, ver `core/policies/`) decide acesso. Use cases recebem principal já resolvido como parâmetro — nunca leem de contexto global.

### Princípio de menor privilégio nos contratos de uso

- Portas expõem o **menor** verbo necessário. `UserRepository` não tem `query(sql: string)` — tem `findById`, `findByEmail`, `save`. Vazar SQL ou query DSL na porta é violação.
- Comandos carregam só os campos que o use case realmente muta. Não passar a entidade inteira "por conveniência".

---

## 6. Manutenibilidade

### Limites estruturais

- **Profundidade de pastas**: máximo 5 níveis a partir da raiz do kit (`kits/<kit>/versions/<v>/core/<layer>/<group>/<file>`). Mais que isso, é sintoma de hierarquia sintética.
- **Tamanho de arquivo "smell"**: arquivos com mais de **300 linhas** são smell não-bloqueante — disparam revisão, não erro. Acima de **600 linhas**, refatoração é obrigatória antes de merge.

### Regras de import (camadas)

A direção é unidirecional, validada por convenção e (quando possível) por lint:

```
domain  ←  application  ←  adapters
   ↑           ↑
   └───── ports ─────┘
```

- `domain/` não importa de `application/`, `adapters/`, nem de nada fora do próprio kit.
- `application/` importa de `domain/` e de `ports/`. Nunca de `adapters/`.
- `adapters/` importa de `ports/` (para implementar) e pode importar de `domain/` apenas para tipos. Nunca de `application/`.
- `ports/` é o contrato puro: só tipos, sem implementação, sem import de runtime externo.

Import cruzando camada na direção errada é defeito de arquitetura.

---

## 7. DX assistida por IA

O diferencial do cullet é ser **prompt-friendly**. Cada kit publica um `KIT_CONTEXT.md` no root do kit (ao lado de `meta.json`), com:

- **Tamanho**: 200–400 tokens. Curto o suficiente para caber em um prompt de contexto sem dominar a janela, longo o suficiente para que um modelo entenda o desenho sem ler o código.
- **Conteúdo obrigatório**:
  1. **Propósito** — uma frase: para que problema este kit é a "bala de cobre".
  2. **Camadas** — quais existem e o que cada uma resolve.
  3. **Decisões-chave** — onde este kit usa `Result`, onde usa exceção, onde fala com portas.
  4. **Pontos de extensão** — quais portas o usuário implementa para plugar o kit numa stack real.
  5. **Não-objetivos** — o que o kit deliberadamente **não** faz, para evitar uso indevido.

O `KIT_CONTEXT.md` é o artefato que um assistente de IA lê antes de ajudar o usuário com o kit. Sem ele, o kit não é considerado completo no catálogo.

---

## Aderência

Um kit só entra no catálogo `cullet` se:

1. Respeita as sete seções acima, ou documenta a divergência em `KIT_CONTEXT.md`.
2. Tem `meta.json`, `KIT_CONTEXT.md`, e testes para domínio e aplicação.
3. Não expõe dependência runtime de lib de observabilidade, log, retry, ou tracing no `package.json` principal.

A filosofia é o contrato. O catálogo é a consequência.
