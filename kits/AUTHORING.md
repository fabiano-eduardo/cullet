# Anatomia de um kit cullet

Este guia descreve o caminho completo do diretório vazio ao kit publicável. O objetivo aqui não é discutir filosofia em abstrato, mas deixar explícito o que precisa existir para um kit entrar no catálogo sem quebrar os contratos do `cullet`.

> **Escopo:** este guia cobre os kits de biblioteca (`kind: foundation` / `capability`) — os que têm superfície de import (e, quando adotam camadas, `core/` e portas). Kits `tooling` têm uma forma bem mais enxuta (sem `core/`, sem import): scaffold com `npm run new-kit -- <nome> --kind tooling`, edite o payload em `files/` e ajuste `meta.json → delivery.copy`. Veja o contrato deles em `PHILOSOPHY.md` (seção "A quem estas regras se aplicam") e o template em `templates/tooling-kit/`.

Use este documento junto com:

- `CONTRIBUTING.md` para as regras de revisão humana e o gate de qualidade;
- `kits/VERSIONING.md` para SemVer por kit e política de deprecação;
- `templates/kit/` para ver o scaffold mínimo esperado.

## 1. Resultado final esperado

O que um kit de biblioteca publicável **sempre** precisa ter são quatro peças: o entry point (`index.ts`), `meta.json`, `README.md` e `KIT_CONTEXT.md`. Tudo o mais dentro de `src/` é a estrutura interna do kit, que você organiza conforme o paradigma dele.

```text
packages/
  nome-do-kit/
    package.json
    meta.json
    README.md
    KIT_CONTEXT.md
    tsdown.config.ts
    src/
      index.ts        # entry point — fronteira do import direto
```

`cullet` **não vincula kits a uma arquitetura**. Como o `src/` é organizado depende do paradigma do kit: um núcleo de negócio pode usar camadas (clean architecture, hexagonal) sob `core/` (`domain/`, `application/` com `ports/`, `errors/`, `exceptions/`, `result/`); um kit de frontend organiza por estado / UI / dados; um SDK ou utilitários têm outras fronteiras ainda. Nenhuma dessas formas é o padrão do catálogo.

Os lints default verificam apenas **princípios** (testes, observabilidade desacoplada, imports honestos, profundidade/tamanho, contexto para IA). As regras que pressupõem camadas (`architectureLayers`, `portsArePure`, `applicationReturnsResult`, `requiredCoreTests`, `noMocksInCoreTests`) são **opt-in**: um kit que adota camadas as **liga** em `meta.json -> lint`. As seções 6 a 8 abaixo descrevem a forma em camadas; leia-as como "quando o kit adota essa estrutura".

## 2. Scaffold inicial

Comece sempre pelo script oficial:

```bash
npm run new-kit -- <nome-do-kit>
# opcional:
npm run new-kit -- <nome-do-kit> --description "Descrição curta do kit"
```

O script copia `templates/kit/` para `kits/<nome>/versions/1.0.0/`, substitui placeholders, cria a entrada em `registry/index.json` e já deixa um `meta.json` válido contra o schema.

Se você estiver abrindo uma nova major de um kit existente, não use o scaffold do zero. Copie a pasta da versão anterior para `versions/<nova-versao>/`, faça as mudanças nessa nova pasta e atualize `registry/index.json` de acordo com `kits/VERSIONING.md`.

## 3. Preencha `meta.json` como contrato, não como inventário

`meta.json` é a peça que o catálogo, o CLI e o validador usam para entender o kit. Os campos abaixo são os que normalmente exigem decisão humana:

| Campo                                         | O que precisa estar certo                                                                                   |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `name`                                        | kebab-case estável; vira parte do import `cullet/<nome>`                                                    |
| `version`                                     | SemVer do kit, não do pacote npm                                                                            |
| `description`                                 | resumo curto, útil e específico                                                                             |
| `compatibility.engines`                       | ranges mínimos testados de Node e TypeScript para o kit                                                     |
| `compatibility.directImport.peerDependencies` | peers e ranges exigidos quando o kit é consumido por `import` direto                                        |
| `compatibility.fullControl.dependencies`      | deps e ranges que o consumidor precisa instalar depois do `cullet fc`                                       |
| `entryPoint`                                  | normalmente `index.ts`; precisa existir                                                                     |
| `philosophy.errorModel`                       | `typed-result`, `typed-exceptions` ou `mixed`                                                               |
| `philosophy.observability`                    | declare `log-port`, `metric-port` e/ou `trace-port` apenas se o kit realmente expõe essas portas            |
| `philosophy.externalDeps`                     | allowlist dos imports runtime externos usados pelo lint arquitetural                                        |
| `docs.context` / `docs.readme`                | caminhos reais dos arquivos markdown                                                                        |
| `exports`                                     | subconjunto curado dos nomes em destaque da superfície pública; `validate-kit` exige que cada um exista no `entryPoint` |
| `deprecated`                                  | `false` para kit ativo; objeto com `since`, `reason` e `successor` estruturado quando houver migração clara |

### Regras práticas para `exports`

- É um subconjunto **curado** dos nomes em destaque — não precisa listar toda a superfície, só o que o consumidor alcança primeiro.
- `validate-kit` segue o `entryPoint` (inclusive `export *` e barris) e **falha** se um nome declarado aqui não for realmente exportado; assim a lista não mente nem apodrece em silêncio. Se um `export *` apontar para um pacote externo que ele não consegue ler, vira aviso em vez de erro.
- `cullet info` mostra a lista em "Principais exports", então mantenha-a representativa.
- Trate a lista como promessa pública: remover nome daqui é breaking change de kit.
- Se a mudança for incompatível, abra uma nova pasta em `versions/<major>.0.0/`.

## 4. Escreva `KIT_CONTEXT.md` para humanos e IA

O `KIT_CONTEXT.md` não é apêndice; ele é parte do contrato do catálogo. O validador espera:

- headings estruturados no formato `## [purpose] Propósito`, `## [layers] Camadas`, `## [key-decisions] Decisões-chave`, `## [extension-points] Pontos de extensão` e `## [non-goals] Não-objetivos`;
- entre 200 e 400 tokens;
- texto real, sem placeholder vazio.

Use esse arquivo para explicar:

- qual problema o kit resolve;
- onde cada camada vive;
- decisões que não devem ser rediscutidas toda vez;
- onde o kit aceita extensão sem quebrar a arquitetura;
- o que o kit deliberadamente não pretende ser.

Se você fizer override em `meta.json -> lint`, a justificativa deve aparecer aqui.

## 5. Escreva o `README.md` do kit como página de consumo

O template já sugere a estrutura certa. Antes da primeira release, troque o conteúdo genérico por quatro blocos reais:

1. `O que entrega`: primitives, módulos e limites da versão.
2. `Como começa`: import direto, import pinado e fluxo `cullet fc`.
3. `Decisões tomadas`: escolhas arquiteturais que moldam o kit.
4. `Como evoluir`: onde adicionar casos de uso, portas, erros e quando abrir nova versão.

Se o kit tiver dependência runtime, explique ali também como ela entra em import direto e em full-control.

## 6. Estrutura em camadas (opt-in)

Esta seção descreve a forma em **camadas** (clean architecture, hexagonal) — uma das estruturas possíveis, não o padrão do catálogo. Vale para um kit que adota camadas e **liga** as regras estruturais em `meta.json -> lint`; um kit de outro paradigma organiza `src/` de outra forma e simplesmente não liga essas regras. Quando o kit adota camadas, as regras estruturais são estáveis:

- `core/domain/` é modelo puro; não importa runtime externo.
- `core/application/` consome portas e expõe classes cujo `Output` precisa ser `Result<...>`.
- `core/application/ports/` guarda apenas contratos puros, com imports tipados e sem implementação.
- `core/errors/` e `core/exceptions/` separam erro de aplicação e exceção de domínio.
- `core/result/` concentra o tipo de retorno da aplicação quando o modelo não é só exceção.

### Observabilidade

Se `meta.json.philosophy.observability` declarar algum destes itens, os arquivos abaixo passam a ser obrigatórios:

- `log-port` -> `core/application/ports/logger.port.ts`
- `metric-port` -> `core/application/ports/metrics.port.ts`
- `trace-port` -> `core/application/ports/tracer.port.ts`

Essas portas não podem importar runtime de observabilidade. Adaptadores concretos ficam fora do core.

### Profundidade da árvore

O validador bloqueia caminhos acima de 5 segmentos a partir da raiz do kit. Se você precisa ir além disso, provavelmente está modelando pasta demais para a superfície que o catálogo quer expor.

## 7. Testes: próximos do código e sem mock no core

As regras automáticas mais importantes aqui são:

- specs sempre colocalizadas e com sufixo `.spec.ts`;
- `__tests__/` e `.test.ts` não entram;
- se existe código em `core/domain/`, precisa existir ao menos um `.spec.ts` nessa área;
- se existe código em `core/application/` fora de `ports/`, precisa existir ao menos um `.spec.ts` nessa área;
- `vi.mock(...)` e `jest.mock(...)` não são aceitos em testes de `core/domain` e `core/application`.

O catálogo favorece teste comportamental real do core. Se você precisa de doubles, concentre isso em adapters ou em testes de integração fora do miolo arquitetural.

## 8. Entry point e superfície pública

O `index.ts` na raiz do kit é a fronteira do import direto. Ele deve reexportar apenas a API que você quer sustentar como contrato do catálogo.

Prática recomendada:

- centralize reexports em `core/index.ts` e depois reexporte esse arquivo pela raiz;
- exponha constantes `NOME_DO_KIT` e `VERSAO_DO_KIT` quando fizer sentido para inspeção;
- mantenha `meta.json.exports` em sincronia com o que está realmente disponível em `index.ts`.

### Manifesto npm do kit

Enquanto a migração para o modelo (c) ainda está em andamento, o `package.json` dentro de `kits/<nome>/versions/<versao>/` é preparatório: ele deve usar o escopo `@cullet/*`, manter `peerDependencies` em sincronia com `meta.json.compatibility.directImport.peerDependencies`, e não pode introduzir `exports` locais para arquivos que não existem na pasta do kit.

O modelo-alvo para cada kit, quando a publicação por pacote estiver ativa, é este:

```jsonc
{
  "name": "@cullet/erp-core",
  "version": "1.0.0",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": { "types": "./dist/index.d.ts", "import": "./dist/index.js" },
    "./errors": {
      "types": "./dist/errors/index.d.ts",
      "import": "./dist/errors/index.js",
    },
    "./policies": {
      "types": "./dist/policies/index.d.ts",
      "import": "./dist/policies/index.js",
    },
    "./package.json": "./package.json",
  },
  "files": ["dist", "src", "meta.json", "KIT_CONTEXT.md", "README.md"],
  "sideEffects": false,
  "engines": { "node": ">=18.17" },
  "peerDependencies": { "zod": ">=3.22.0 <5" },
  "publishConfig": { "access": "public" },
  "license": "MIT",
}
```

Adapte os subpaths ao que o kit realmente expõe. Se o kit não tiver `./errors` ou `./policies`, mantenha apenas `.` e `./package.json`.

## 9. Registro, versão e deprecação

Para um kit novo, o `new-kit` já cria a entrada inicial no `registry/index.json`.

Para uma versão nova de um kit existente:

1. copie a versão anterior para uma nova pasta em `versions/<nova-versao>/`;
2. atualize `meta.json.version` e `meta.json.changelog`;
3. acrescente a versão em `registry/index.json -> versions`;
4. atualize `latest` se a nova versão for a referência principal;
5. marque a versão antiga como `deprecated` quando houver sucessor explícito, preferindo o formato estruturado com `guide` e `codemod` para que `cullet migrate` consiga expor o caminho de upgrade.

Versões publicadas são imutáveis. Bug crítico se resolve com PATCH novo, nunca editando a pasta antiga.

## 10. Checklist antes do PR

Antes de abrir PR, rode pelo menos:

```bash
npm run validate-kits
npm run build
```

E revise esta lista:

- `meta.json`, `README.md`, `KIT_CONTEXT.md` e `entryPoint` existem e não estão vazios;
- `KIT_CONTEXT.md` cabe no orçamento e tem todas as seções exigidas;
- as portas em `core/application/ports/` continuam puras;
- não há import upward nem dependência runtime externa vazando para o core;
- os testes do core estão colocados ao lado do código e usam `.spec.ts`;
- a versão do kit e o `registry/index.json` refletem a mudança corretamente.

## 11. Checklist antes da release do pacote

Com o catálogo agora usando `changesets`, o merge do seu PR só participa da próxima release do pacote se houver um changeset na raiz do repositório.

Fluxo mínimo:

```bash
npm run changeset
```

Depois disso:

- descreva a mudança em termos do consumidor do pacote, não apenas do diff interno;
- escolha `patch`, `minor` ou `major` para o pacote `cullet` com a mesma disciplina que você usou no kit;
- deixe o release PR automatizado cuidar de `package.json`, `CHANGELOG.md`, tag e publish.
