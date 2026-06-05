# Filosofia do cullet

Este documento existe para tornar a "filosofia comum" do `cullet` um **artefato verificável**, não um valor declarado em README. Quando um kit divergir, a divergência deve ser explícita no `KIT_CONTEXT.md` do próprio kit, com justificativa.

Checklist operacional, buckets A/B/C e revisão humana obrigatória vivem em `CONTRIBUTING.md`.

Esta filosofia é o critério de curadoria. Se um kit não a respeita, não é cullet.

## O que é princípio e o que é forma

O contrato do `cullet` são **princípios**, não uma arquitetura. As sete seções abaixo descrevem esses princípios — erros explícitos, observabilidade desacoplada, núcleo testável sem mock pesado, política de resiliência declarada, validação na borda, manutenibilidade, contexto para IA. Princípios são neutros de paradigma: valem para um núcleo de ERP, para uma biblioteca de componentes React/Vue/Angular, para um SDK, para um cliente de fila, para utilitários — para o que for.

O que **não** é universal é a *forma* que cada princípio assume. `cullet` **não elege uma arquitetura de referência**: cada kit cumpre os princípios na estrutura que faz sentido para o seu paradigma. Arquiteturas em camadas (clean architecture, hexagonal, as camadas típicas de um frontend) são apenas algumas das formas possíveis — nenhuma é o padrão do catálogo. Por isso os lints **default** de `validate-kit.mjs` verificam só os princípios; regras que pressupõem uma arquitetura específica são **opt-in** por kit (ver "Princípio versus estrutura").

Ao longo do texto, quando uma estrutura concreta aparecer (camadas, "porta", `domain` / `application` / `adapters`), leia como **um exemplo de como cumprir o princípio**, não como exigência. O princípio é o que está em negrito; a estrutura é uma escolha do kit.

## A quem estas regras se aplicam: `kind`

`cullet` não é um pacote de starter kits importáveis. Ser um módulo TypeScript importável é uma capacidade **opt-in**, não um invariante do catálogo. Cada kit declara sua natureza em `meta.json` via `kind`, e isso define a quais regras ele responde:

- **`foundation` / `capability`** — kits de biblioteca (o padrão quando `kind` está ausente). São consumidos por import direto ou cópia full-control e **respondem às sete seções abaixo**, na forma que combina com seu paradigma. É para eles que o gate arquitetural de `validate-kit.mjs` foi escrito.
- **`tooling`** — kits copy-only (ex.: um harness de agente de IA, configs, hooks, scripts). Não têm núcleo de código, fronteiras, nem superfície de import; logo as sete seções de arquitetura de software **não se aplicam**. O contrato deles é mínimo: declarar `delivery.copy` (com `placement` e `source`) e trazer um payload que o `npx cullet fc <kit>` mescla no projeto consumidor — inclusive em projetos já em andamento. O que permanece obrigatório é o `KIT_CONTEXT.md` (seção 7) como artefato de DX por IA.

As sete seções a seguir são o contrato dos **kits de biblioteca**, lidas na forma que o paradigma de cada kit assume.

## Princípio versus estrutura

Nem todo kit de biblioteca é um núcleo de domínio backend. Um kit pode ser:

- um núcleo de regras de negócio backend;
- uma biblioteca de frontend (componentes React/Vue/Angular, hooks, máquinas de estado, design system);
- um cliente/SDK, um conjunto de adaptadores de integração, utilitários transversais, etc.

Cada paradigma tem **fronteiras** diferentes, e nenhuma é privilegiada pelo catálogo. Um núcleo de negócio pode separar regra pura / orquestração / mundo externo (a forma de uma arquitetura em camadas). Um kit de frontend separa, por exemplo, lógica de estado e regras de apresentação / componentes de UI / acesso a dados e efeitos. A **separação** é o princípio; quais são as fronteiras concretas depende do kit.

Como os defaults verificam só princípios, um kit não precisa "anunciar" que diverge — ele já nasce livre de arquitetura. O que um kit faz é o inverso:

1. Se adota uma arquitetura em camadas e quer que o catálogo a faça cumprir, **liga** as regras estruturais correspondentes em `meta.json -> lint` (`architectureLayers`, `portsArePure`, `applicationReturnsResult`, `requiredCoreTests`, `noMocksInCoreTests` com `warn` ou `error`). Ligar essas regras é opt-in.
2. Documenta no `KIT_CONTEXT.md` (seção `[layers]`) **quais** fronteiras ele realmente tem e por quê.
3. Honra o **espírito** das sete seções em qualquer caso: erros tipados, observabilidade desacoplada, núcleo testável, política explícita, validação na borda, manutenibilidade e contexto para IA não dependem de nenhuma arquitetura — só mudam de forma.

Tanto ligar uma regra estrutural quanto desligar um lint de princípio é uma decisão consciente, documentada no `KIT_CONTEXT.md`.

---

## 1. Erros

### Hierarquia explícita

Todo kit reconhece três classes de erro, e nenhuma outra. A divisão é por **natureza**, não por pasta:

- **Erro de regra/invariante** — uma regra do kit foi violada, uma transição de estado é impossível, um valor quebra um invariante. Sinaliza bug ou estado que não deveria existir. Num kit em camadas costuma viver em `core/exceptions/`; em qualquer estrutura, nunca depende de runtime, rede ou framework.
- **Erro de operação esperada** — uma operação foi recusada por um motivo conhecido e previsível: não-encontrado, conflito, autorização negada, idempotência violada, entrada inválida na borda. É um resultado, não uma surpresa. Num kit em camadas costuma viver em `core/errors/` e implementa `AppError` (ou equivalente).
- **Erro de integração externa** — falha de I/O, integração, serialização, dependência indisponível. Sempre encapsulado em `IntegrationError` (ou equivalente) antes de cruzar a fronteira externa. Stack trace original preservado em `cause`.

A regra é: **invariante é lançado, operação esperada é retornada, falha de integração é traduzida**.

### Nunca capturar para esconder

`catch` sem rethrow, log, ou conversão tipada é proibido. Toda captura precisa terminar em uma de três coisas:

1. Rethrow (eventualmente envelopado em uma classe da hierarquia acima).
2. Conversão para `Result.fail(...)` com erro tipado.
3. Log estruturado **mais** rethrow — nunca log puro que engole.

`catch (_)` que descarta o erro é um defeito, não um estilo.

### Convenção: `Result<T, E>` para falha esperada, exceções tipadas para invariante

Escolha tomada e fixa para todo o catálogo, em qualquer paradigma:

- **Invariantes** usam **exceções tipadas** (`DomainException` e descendentes). Invariantes não são caminhos felizes — sinalizam bug ou estado impossível, e devem interromper o fluxo. Forçar `Result` aqui mascara invariantes como erros recuperáveis.
- **Operações que falham de forma previsível** usam **`Result<T, E>`** (num kit em camadas, p.ex. `core/result/result.ts`). O chamador precisa enxergar a falha no tipo.
- **Integração externa** pode lançar internamente, mas **expõe `Result`** para quem consome. A tradução é responsabilidade de quem fala com o mundo externo, não do caller.

Não há terceira via. Numa arquitetura em camadas isso mapeia direto em domínio (exceção) / aplicação (`Result`) / adapter (traduz); em outros paradigmas o eixo é o mesmo — só os nomes das fronteiras mudam.

---

## 2. Observabilidade

Cada kit que faz trabalho observável DEVE expô-lo via **contratos injetáveis** — nunca acoplado a uma lib específica. Em arquiteturas em camadas esses contratos costumam ser chamados de **portas**, mas o nome não importa; em qualquer paradigma a regra é: o kit define a abstração, o consumidor injeta a implementação.

### Logs estruturados

- Contrato `LoggerPort` (ou equivalente) com níveis `debug | info | warn | error` e payload tipado como `Record<string, unknown>`.
- Mensagens em inglês, snake_case nas chaves. Sem string interpolation no `message` — contexto vai no payload.
- O kit nunca importa `pino`, `winston`, `bunyan`, `console`. Adapters/implementações opcionais ficam separados e são publicados à parte ou copiados via full-control.

### Métricas

- Contrato `MetricsPort` com `counter`, `gauge`, `histogram`. Nomes em `snake_case` com namespace do kit (ex.: `erp_core_use_case_duration_ms`).
- Cardinalidade controlada no contrato: labels declarados, não livres.

### Tracing

- Contrato `TracerPort` compatível com a forma do OpenTelemetry (`startSpan`, `setAttribute`, `end`, `recordException`) — sem importar `@opentelemetry/*`.
- Cada operação relevante roda dentro de um span. Falhas previsíveis viram `span.setStatus({ code: ERROR })`; violações de invariante também.

Um kit cujo paradigma não produz telemetria de servidor (ex.: biblioteca de componentes pura) desliga `observabilityPorts` em `meta.json -> lint` e registra a decisão no `KIT_CONTEXT.md`.

---

## 3. Testes

### O núcleo é testável sem mock pesado

- **Lógica pura** (regras, invariantes, decisões — onde quer que vivam no kit; num kit em camadas, p.ex. `core/domain/`, `core/exceptions/`, `core/policies/`) — testada **sem nenhum mock**. Se um teste de regra pura precisa mockar I/O, a regra está acoplada a infra. Bug de design, não de teste.
- **Lógica de orquestração** (casos de uso — num kit em camadas, p.ex. `core/application/`) — testada com **stubs in-memory dos contratos**. Não usa `jest.mock`, `vi.mock`, ou mocking de módulo. Stubs são objetos tipados que implementam o contrato — vivem em `test/stubs/` quando reusados.
- **Integrações** (adapters, clientes — num kit em camadas, p.ex. `adapters/*`) — testadas contra o serviço real (Postgres real, Redis real) via testcontainers ou ambiente local. Mocks aqui não provam nada.

Regra-mãe: **o núcleo de valor do kit não depende de infra mockada**. Se você precisa mockar para testar o núcleo, o núcleo está errado.

### Nomenclatura

- `*.spec.ts` ao lado do arquivo testado. Nada de pasta `__tests__/` paralela.
- Bloco raiz: `describe("ClassName" | "functionName", ...)`.
- Casos: `it("does X when Y", ...)` — descrição em inglês, voz ativa, sem "should".

### Organização

- Um arquivo de teste por unidade pública. Helpers de teste em `*.test-helpers.ts` (não `.spec.ts` para o runner não recolher).
- Fixtures complexas em `test/fixtures/`.

---

## 4. Resiliência

A divisão é estrita: **quem decide a política não é quem a executa**. Numa arquitetura em camadas, portas decidem e adapters implementam; o princípio vale para qualquer fronteira entre intenção e I/O.

### Quem decide (o contrato / a orquestração)

- **Timeouts** — toda operação que cruza um boundary declara `timeoutMs` no contrato. Sem timeout default escondido na implementação.
- **Retries** — política declarada no contrato (`RetryPolicy { maxAttempts, backoff }`). Quem orquestra decide se retry faz sentido para aquele fluxo (idempotente? recuperável?).
- **Idempotência** — chave de idempotência é parâmetro do comando, não responsabilidade da implementação. As regras definem que comandos são idempotentes; a orquestração garante a chave.
- **Circuit breaker** — estado e thresholds expostos via contrato `CircuitBreakerPort`. Quem orquestra pergunta "posso chamar?", não a implementação.

### Quem implementa (a integração)

- A implementação traduz a política em chamadas concretas (`AbortController` para timeout, lib específica para retry, Redis para idempotency key store, etc.).
- A implementação nunca decide política. Retry hardcoded na implementação vaza acoplamento.

---

## 5. Segurança

### Validação na borda

- Entrada externa (HTTP, fila, CLI, formulário, props não confiáveis) é validada **uma vez**, na entrada, contra um schema tipado. A partir daí, o tipo carrega a garantia — nada de revalidar no miolo.
- Validação retorna `Result.fail(ValidationError)`, nunca lança.
- O núcleo assume input válido em tipo. Se um value object precisa rejeitar valor, é invariante (lança), não validação (retorna).

### Contratos para authz/authn

- **Authn** — contrato `AuthenticatorPort` resolve credencial em principal. Sempre um contrato, nunca um middleware acoplado.
- **Authz** — contrato `AuthorizerPort` (ou policies de regra) decide acesso. A orquestração recebe o principal já resolvido como parâmetro — nunca lê de contexto global.

### Princípio de menor privilégio nos contratos de uso

- Contratos expõem o **menor** verbo necessário. `UserRepository` não tem `query(sql: string)` — tem `findById`, `findByEmail`, `save`. Vazar SQL ou query DSL no contrato é violação.
- Comandos carregam só os campos que a operação realmente muta. Não passar a entidade inteira "por conveniência".

---

## 6. Manutenibilidade

### Limites estruturais

- **Profundidade de pastas**: máximo 5 níveis a partir da raiz do kit. Mais que isso, é sintoma de hierarquia sintética.
- **Tamanho de arquivo "smell"**: arquivos com mais de **300 linhas** são smell não-bloqueante — disparam revisão, não erro. Acima de **600 linhas**, refatoração é obrigatória antes de merge.

### Regras de dependência

A direção das dependências é unidirecional: **o que é estável e abstrato não conhece o que é volátil e concreto**. Numa arquitetura em camadas (clean architecture, hexagonal, ou as camadas de um frontend) isso costuma se expressar como:

```
domain  ←  application  ←  adapters
   ↑           ↑
   └───── ports ─────┘
```

- `domain/` não importa de `application/`, `adapters/`, nem de nada fora do próprio kit.
- `application/` importa de `domain/` e de `ports/`. Nunca de `adapters/`.
- `adapters/` importa de `ports/` (para implementar) e pode importar de `domain/` apenas para tipos. Nunca de `application/`.
- `ports/` é o contrato puro: só tipos, sem implementação, sem import de runtime externo.

Em outro paradigma as fronteiras têm outros nomes, mas a invariante é a mesma: dependência aponta para o núcleo estável, nunca o contrário. Import na direção errada é defeito de arquitetura. Um kit em camadas **liga** `architectureLayers`/`portsArePure` em `meta.json -> lint` para o catálogo fazer cumprir essa direção; um kit de outra estrutura simplesmente não as liga e descreve a direção real de dependências no `KIT_CONTEXT.md`.

---

## 7. DX assistida por IA

O diferencial do cullet é ser **prompt-friendly**. Cada kit publica um `KIT_CONTEXT.md` no root do kit (ao lado de `meta.json`), com:

- **Tamanho**: 200–400 tokens. Curto o suficiente para caber em um prompt de contexto sem dominar a janela, longo o suficiente para que um modelo entenda o desenho sem ler o código.
- **Conteúdo obrigatório**:
  1. **Propósito** (`[purpose]`) — uma frase: para que problema este kit é a "bala de cobre".
  2. **Fronteiras** (`[layers]`) — quais existem **neste kit** e o que cada uma resolve: camadas, módulos, slices ou o que o paradigma do kit usar.
  3. **Decisões-chave** (`[key-decisions]`) — onde este kit usa `Result`, onde usa exceção, onde fala com contratos, e qual override de lint ele declara e por quê.
  4. **Pontos de extensão** (`[extension-points]`) — quais contratos o usuário implementa para plugar o kit numa stack real.
  5. **Não-objetivos** (`[non-goals]`) — o que o kit deliberadamente **não** faz, para evitar uso indevido.

O `KIT_CONTEXT.md` é o artefato que um assistente de IA lê antes de ajudar o usuário com o kit. Sem ele, o kit não é considerado completo no catálogo.

---

## Aderência

Um kit de biblioteca (`foundation` / `capability`) só entra no catálogo `cullet` se:

1. Respeita o **espírito** das sete seções acima, na forma do seu paradigma, e documenta no `KIT_CONTEXT.md` as fronteiras e decisões que adota.
2. Tem `meta.json`, `KIT_CONTEXT.md`, e testes para a lógica de valor do kit.
3. Não expõe dependência runtime de lib de observabilidade, log, retry, ou tracing no `package.json` principal.
4. Quando adota uma arquitetura em camadas, **liga** as regras estruturais correspondentes em `meta.json -> lint`; quando desliga um lint de princípio (raro), justifica no `KIT_CONTEXT.md`. Em nenhum caso finge uma estrutura que não tem.

Um kit `tooling` entra no catálogo se:

1. Tem `meta.json` com `kind: "tooling"` e um `delivery.copy` válido (`placement` + `source`) apontando para um payload existente.
2. Tem `KIT_CONTEXT.md` real (seção 7).
3. Declara em `delivery.copy.dependencies` qualquer dependência externa que o consumidor precise instalar após a cópia.

A filosofia é o contrato. O catálogo é a consequência.
</content>
</invoke>
