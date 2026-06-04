# Contributing Kits

Este documento transforma o [PHILOSOPHY.md](./PHILOSOPHY.md) em protocolo de contribuição e revisão.

Para o caminho operacional do scaffold até um kit publicável, use primeiro [`kits/AUTHORING.md`](./kits/AUTHORING.md). Este arquivo fica como complemento de gate e revisão.

## Como o gate funciona

- `npm run validate-kits` aplica regras automáticas sobre `meta.json`, estrutura do kit, imports, contratos de aplicação, observabilidade, testes e `KIT_CONTEXT.md`.
- Toda regra automática pode ser afrouxada por kit em `meta.json -> lint` com `off | warn | error`.
- Override é exceção, não padrão. Quando houver override, a justificativa deve aparecer no `KIT_CONTEXT.md` do kit.

Exemplo:

```json
{
  "lint": {
    "testConventions": "warn",
    "fileSize": "warn"
  }
}
```

## Perfil arquitetural

As tabelas de auditoria abaixo descrevem o **perfil padrão** do `cullet`: clean architecture (camadas `domain` / `application` / `adapters`, portas, `Result`), que é o que os lints default codificam. Nem todo kit de biblioteca é desse perfil — pode ser frontend, SDK, utilitários. Um kit de outro paradigma satisfaz os mesmos **princípios** (ver [`PHILOSOPHY.md`](./PHILOSOPHY.md)) com outra estrutura e declara isso desligando as regras estruturais que não se aplicam (`architectureLayers`, `portsArePure`, `observabilityPorts`, `applicationReturnsResult`, `requiredCoreTests`, …) em `meta.json -> lint`, com a justificativa no `KIT_CONTEXT.md`. As tabelas valem integralmente para o perfil padrão; para os demais, leia "regra" como "regra quando aplicável ao paradigma do kit".

## Convenções do repositório

- Arquivos e pastas de uma palavra usam lowercase simples: `list.ts`, `doctor.ts`, `registry/`.
- Arquivos e pastas com mais de uma palavra usam kebab-case: `full-control.ts`, `kit-context.ts`, `check-pack-contents.mjs`.
- `cli/` é implementação interna do binário. Tipos e loaders que fazem parte de APIs públicas ou viram contrato semver devem morar ao lado da própria API pública (`registry/`, `kits/`) ou em módulo compartilhado neutro, nunca pendurados em `cli/utils/`.
- Quando tocar em um arquivo legado fora dessa convenção, normalize o nome no mesmo PR em vez de reproduzir o padrão antigo.

## Cobertura atual

Usando os blocos de regra abaixo como unidade de auditoria, o catálogo está com **14 de 19 blocos automatizados (~74%)**. Os 5 blocos restantes exigem revisão humana obrigatória no PR.

## Auditoria do PHILOSOPHY

### 1. Erros

| Regra                                                                 | Bucket | Situação atual                                        |
| --------------------------------------------------------------------- | ------ | ----------------------------------------------------- |
| O kit declara seu modelo de erro em `meta.json` e respeita schema     | A      | `kit-spec.schema.json` valida `philosophy.errorModel` |
| Casos de uso da aplicação expõem falha no tipo com `Result`           | B      | `validate-kit.mjs` aplica `applicationReturnsResult`  |
| `catch` não engole erro; infra sempre traduz antes de cruzar boundary | C      | Revisão humana obrigatória                            |

### 2. Observabilidade

| Regra                                                                                       | Bucket | Situação atual                                                                                |
| ------------------------------------------------------------------------------------------- | ------ | --------------------------------------------------------------------------------------------- |
| `LoggerPort`, `MetricsPort`, `TracerPort` existem e não importam runtime de observabilidade | B      | `validate-kit.mjs` aplica `observabilityPorts`, `portsArePure` e `noObservabilityRuntimeDeps` |
| Cada use case abre span e marca erro no tracing                                             | C      | Revisão humana obrigatória                                                                    |

### 3. Testes

| Regra                                                                                            | Bucket | Situação atual                                 |
| ------------------------------------------------------------------------------------------------ | ------ | ---------------------------------------------- |
| `core/domain` e `core/application` não usam `vi.mock` / `jest.mock`                              | B      | `validate-kit.mjs` aplica `noMocksInCoreTests` |
| Specs usam `.spec.ts`, evitam `__tests__/`, têm `describe` raiz compatível e `it()` em voz ativa | B      | `validate-kit.mjs` aplica `testConventions`    |
| Helpers, fixtures complexas e adapters testados com serviço real seguem a disciplina descrita    | C      | Revisão humana obrigatória                     |

### 4. Resiliência

| Regra                                                                                           | Bucket | Situação atual             |
| ----------------------------------------------------------------------------------------------- | ------ | -------------------------- |
| Timeout, retry, idempotência e circuit breaker são decididos na aplicação/porta, não no adapter | C      | Revisão humana obrigatória |

### 5. Segurança

| Regra                                                                      | Bucket | Situação atual             |
| -------------------------------------------------------------------------- | ------ | -------------------------- |
| Validação acontece uma vez na borda e falha previsível volta como `Result` | C      | Revisão humana obrigatória |
| Authn/Authz e contratos de uso seguem menor privilégio                     | C      | Revisão humana obrigatória |

### 6. Manutenibilidade

| Regra                                                                             | Bucket | Situação atual                                                                                                                               |
| --------------------------------------------------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Profundidade estrutural do kit fica em até 5 segmentos a partir da raiz           | B      | `validate-kit.mjs` aplica `folderDepth`                                                                                                      |
| Arquivos acima de 300 linhas geram warning; acima de 600 exigem atenção imediata  | B      | `validate-kit.mjs` aplica `fileSize`                                                                                                         |
| Imports externos declarados, imports upward e direção entre camadas são validados | A      | Regras existentes `noExternalImports`, `noUpwardImports`, `nodenextImports` foram mantidas; `architectureLayers` foi acrescentada nesta fase |
| `ports/` permanece contrato puro, com imports tipados e sem implementação         | B      | `validate-kit.mjs` aplica `portsArePure`                                                                                                     |

### 7. DX assistida por IA

| Regra                                                                                                                        | Bucket | Situação atual                                                            |
| ---------------------------------------------------------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------- |
| `KIT_CONTEXT.md` existe, não está vazio e cabe no orçamento de contexto                                                      | A      | Existência já era validada; orçamento agora é verificado por `kitContext` |
| `KIT_CONTEXT.md` usa headings estruturados (`[purpose]`, `[layers]`, `[key-decisions]`, `[extension-points]`, `[non-goals]`) | B      | `validate-kit.mjs` aplica `kitContext`                                    |

### Aderência de catálogo

| Regra                                                                                   | Bucket | Situação atual                                         |
| --------------------------------------------------------------------------------------- | ------ | ------------------------------------------------------ |
| `meta.json`, `README.md`, `KIT_CONTEXT.md` e `entryPoint` existem e passam no schema    | A      | Existência + schema + `compatibility` já são validados |
| Kits com código em `core/domain` e `core/application` precisam de specs correspondentes | B      | `validate-kit.mjs` aplica `requiredCoreTests`          |
| `package.json` do kit não expõe runtime de observabilidade                              | B      | `validate-kit.mjs` aplica `noObservabilityRuntimeDeps` |
| Divergências de filosofia ficam explicitadas no contexto do kit                         | C      | Revisão humana obrigatória                             |

## Checklist obrigatório de PR

- Confirmar que todo `catch` termina em `throw`, `Result.fail(...)`/`Result.err(...)` tipado, ou log estruturado **mais** rethrow.
- Confirmar que os use cases que cruzam boundaries realmente abrem span e anotam falhas previsíveis.
- Confirmar que adapters importantes têm teste com dependência real, não apenas mock.
- Confirmar que timeout, retry, idempotência e circuit breaker foram declarados na porta certa, com a política decidida pela aplicação.
- Confirmar que validação de entrada acontece na borda do adapter e não reaparece no use case.
- Confirmar que authn/authz não depende de contexto global e entra por porta/policy explícita.
- Confirmar que os contratos expõem o menor verbo necessário; nada de `query(sql)` ou “entidade inteira por conveniência”.
- Confirmar que qualquer override em `meta.json -> lint` está justificado no `KIT_CONTEXT.md`.

## Leitura operacional

- Rodar `npm run validate-kits` antes de abrir PR.
- Se aparecer warning estrutural recorrente, tratar como débito explícito no PR, não como ruído.
- Se uma regra automática bloquear um kit legítimo, prefira override explícito em `meta.json` com justificativa curta no contexto do kit.
