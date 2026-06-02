# cullet

`cullet` é um catálogo opinativo de blocos de construção arquiteturais para TypeScript. O pacote `cullet` é a **CLI + catálogo**: ele descobre, audita, copia e migra kits. Cada kit é publicado como seu **próprio pacote npm** (`@cullet/<kit>`). Ser um módulo TypeScript importável **não** é um invariante do catálogo — é uma capacidade opt-in. Cada kit declara sua natureza em `meta.json` via `kind`:

- **`foundation` / `capability`** — kits de biblioteca importáveis (o padrão quando `kind` está ausente). Entregam uma arquitetura curada para um tipo de problema, com decisões já tomadas sobre erros, observabilidade, testes, resiliência, segurança e manutenibilidade. Cada um é publicado como `@cullet/<kit>` e consumido por **import direto** (`import { Entity } from '@cullet/erp-core'`) ou por **cópia full-control** (`npx cullet fc erp-core@1.0.0`).
- **`tooling`** — kits copy-only (ex.: um harness de agente de IA, configs, hooks, scripts). Não são importáveis: declaram um `placement` e trazem um payload `files/` que o `npx cullet fc <kit>` mescla nesse lugar do projeto (ex.: `.claude/`). Sem import, sem alias de `tsconfig`. Por serem cópia, podem ser adicionados a qualquer momento — inclusive a um projeto já em andamento.

O nome vem de "bala de cobre", uma piada com a frase "não existe bala de prata". Talvez não exista bala de prata, mas pode existir uma bala de cobre: não a solução perfeita universal, mas o bloco certo para o problema certo. `cullet` não é framework, não é gerador de código — é uma curadoria de blocos arquiteturais e ferramentas que você adota quando precisar, começando do zero ou plugando num projeto existente, sem abrir mão do controle total.

A filosofia completa (modelo de erros, observabilidade, testes, resiliência, segurança, manutenibilidade) vive em [`PHILOSOPHY.md`](https://github.com/fabiano-eduardo/cullet/blob/main/PHILOSOPHY.md). As regras de versionamento em [`kits/VERSIONING.md`](https://github.com/fabiano-eduardo/cullet/blob/main/kits/VERSIONING.md).

A documentação navegável é publicada no GitHub Pages do projeto.

---

## Instalação

```bash
npm install cullet
```

Isso instala a **CLI e o catálogo**. Os kits são pacotes próprios: você os instala sob demanda (`npm install @cullet/<kit>`) ou deixa o `npx cullet fc <kit>` instalar para você.

Antes de consumir qualquer kit, rode o doctor para validar o tsconfig e o package.json do seu projeto:

```bash
npx cullet doctor
```

Ele aponta problemas comuns: `moduleResolution` incompatível, `"type": "module"` ausente, `paths` sem `baseUrl`, TypeScript abaixo da versão mínima testada.

---

## Os dois modos, lado a lado

> Esta seção descreve os kits de biblioteca (`foundation` / `capability`). Kits `tooling` são sempre copy-only: não têm import direto, só o `npx cullet fc <kit>` que mescla o payload no placement do projeto (veja [`cullet fc`](#cullet-fc-kit)).

Kits de biblioteca têm dois modos de consumo. Eles **não são exclusivos**: você pode começar via import direto e migrar um kit específico para full-control quando precisar customizar. Em ambos os modos o import no seu código é o mesmo (`@cullet/<kit>`) — o que muda é onde o código vive.

| Aspecto               | **Import direto** (`@cullet/<kit>`)                 | **Full-control** (`npx cullet fc <kit>`)                                          |
| --------------------- | --------------------------------------------------- | --------------------------------------------------------------------------------- |
| Onde o código vive    | Em `node_modules/@cullet/<kit>/dist`                | Copiado para `./cullet/<kit>@<versão>/` dentro do seu projeto                     |
| Como atualiza         | `npm update @cullet/<kit>` traz versões novas       | Não atualiza sozinho — é seu fork local                                           |
| Quando customizar     | Forks via composição em volta da API exportada      | Você edita o kit livremente como código próprio                                   |
| Como o TS resolve     | Pelo campo `exports` do pacote `@cullet/<kit>`      | Alias `@cullet/<kit>` em `tsconfig.json` apontando para `./cullet/<kit>@<v>/`     |
| Dependências externas | Declaradas como `peerDependencies` do pacote do kit | **Você instala manualmente** — `compatibility.fullControl.dependencies` no `meta` |

### Exemplo lado a lado

A única diferença entre os dois modos é a preparação. O código de aplicação é idêntico.

**Import direto** — instale o pacote do kit e importe:

```bash
npm install @cullet/erp-core
```

```ts
// modo: import direto
import {
  Entity,
  ValueObject,
  PolicyCatalog,
  PolicyService,
  mapPolicyEvaluationError,
  type PolicyDecision,
} from "@cullet/erp-core";
```

**Full-control** — depois de `npx cullet fc erp-core@1.0.0`:

O `fc` instala `@cullet/erp-core`, copia o `src/` do kit para `./cullet/erp-core@1.0.0/` e registra no `tsconfig.json` o alias `@cullet/erp-core -> ./cullet/erp-core@1.0.0/index.ts`. Por isso o import continua idêntico — o alias resolve para a cópia local, que agora é código seu, editável:

```ts
// modo: full-control (alias @cullet/erp-core -> ./cullet/erp-core@1.0.0/index.ts)
import {
  Entity,
  ValueObject,
  PolicyCatalog,
  PolicyService,
  mapPolicyEvaluationError,
  type PolicyDecision,
} from "@cullet/erp-core";
```

Para um exemplo de domínio completo com a API real do kit (`Entity`, `ValueObject`, `PolicyService`, composição sem singletons), veja o [README do `erp-core`](../erp-core/README.md) e o `KIT_CONTEXT.md` do kit.

> Quer fixar uma versão exata? Fixe a versão npm do pacote do kit no seu `package.json`:
>
> ```json
> { "dependencies": { "@cullet/erp-core": "1.0.0" } }
> ```

---

## CLI

Depois de instalar `cullet`, o binário fica disponível no projeto. Em geral, o fluxo mais prático é via `npx`.

### `cullet list`

```bash
npx cullet list
```

Lista os kits do registry, suas versões, o `kind` de cada um, descrições e deprecações.

### `cullet info <kit>`

```bash
npx cullet info erp-core
npx cullet info erp-core@1.0.0
npx cullet info erp-core --full   # KIT_CONTEXT.md integral, sem resumir
npx cullet info erp-core --alias  # cria o alias @cullet/erp-core no tsconfig
```

Valida o kit no registry, mostra como consumi-lo (import `@cullet/<kit>` para kits de biblioteca, ou o comando `fc` para kits `tooling`), lista a matriz de compatibilidade declarada no `meta.json` (`compatibility.engines` e `compatibility.directImport.peerDependencies`), consulta as versões publicadas no npm e exibe um resumo do `KIT_CONTEXT.md` estruturado — a janela direta para decidir se o kit cabe no seu projeto. Com `--alias`, registra no `tsconfig.json` um alias `@cullet/<kit>` apontando para o pacote instalado em `node_modules`.

### `cullet fc <kit>`

```bash
npx cullet fc erp-core
npx cullet fc erp-core@1.0.0
npx cullet fc erp-core@1.0.0 --dry-run
npx cullet fc erp-core@1.0.0 --no-install   # assume que o pacote já está presente
```

> O argumento é o **nome do kit no registry** (`erp-core`), não o nome npm com escopo (`@cullet/erp-core`).

Para um kit de biblioteca (`foundation` / `capability`), instala o pacote `@cullet/<kit>` (a menos que `--no-install`), copia o `src/` do kit para `./cullet/<nome>@<versão>/` e cria/atualiza o alias `@cullet/<nome>` no `tsconfig.json` apontando para essa cópia. Avisa se o seu `baseUrl` não é `"."` (porque o `paths` é resolvido relativo a `baseUrl`) e lista `compatibility.fullControl.dependencies`, com ranges, que você precisa instalar manualmente — no full-control, as `peerDependencies` do pacote do kit deixam de influenciar: o Node passa a resolver imports pelo `node_modules` do seu projeto.

Para um kit `tooling`, copia o payload `files/` do kit para o `placement` declarado em `meta.json` (ex.: `.claude/`), mesclando com o que já existir ali — sem alias de `tsconfig`. É assim que se adiciona um harness ou conjunto de configs a um projeto em andamento. As dependências externas, quando houver, vêm de `delivery.copy.dependencies`.

Com `--dry-run`, o CLI mostra o destino, uma amostra dos arquivos que seriam copiados e o alias resultante, sem escrever nada.

Se o destino já existir e você estiver em modo real, o CLI pede confirmação antes de sobrescrever. A troca é transacional: o conteúdo antigo vai para backup temporário e só sai de cena quando a nova cópia assume o lugar, então falhas no meio não deixam o projeto em estado parcialmente sobrescrito.

### `cullet migrate <kit>`

```bash
npx cullet migrate erp-core@1.0.0
npx cullet migrate erp-core@1.0.0 --dry-run
npx cullet migrate erp-core@1.0.0 --apply
```

Lê o caminho de migração declarado em `meta.json -> deprecated.successor`, mostra o sucessor recomendado, o guia de migração e o codemod associado quando existirem. Sem flags, só imprime o plano. Com `--dry-run`, executa o codemod em modo simulado. Com `--apply`, executa a migração no diretório atual.

`--dry-run` e `--apply` carregam e executam o codemod publicado pelo kit no processo do CLI. Use essas flags apenas para kits e versões cuja origem você confia e revisou.

### `cullet doctor`

```bash
npx cullet doctor
npx cullet doctor --cwd ./outro-projeto
```

Audita o projeto consumidor procurando configurações incompatíveis com o `cullet`:

- `tsconfig.json` com `moduleResolution` que não respeita os `exports` dos pacotes (`node`, `node10`, `classic`).
- `package.json` sem `"type": "module"` (os kits são publicados como ESM).
- `paths` configurado mas `baseUrl` ausente.
- TypeScript abaixo do mínimo testado (5.0).

Retorna exit code `1` quando há erros — útil para colocar em CI.

### `cullet telemetry`

```bash
npx cullet telemetry status
npx cullet telemetry enable
npx cullet telemetry enable --endpoint https://telemetry.example.dev/events
npx cullet telemetry disable
```

A telemetria é explicitamente opt-in (desabilitada por padrão). Quando habilitada, cada execução de comando grava um evento anônimo em um log local (`events.ndjson`) e, opcionalmente, envia o mesmo payload por HTTPS `POST` para um endpoint configurado. Endpoints sem `https://` são rejeitados. O payload contém apenas dados de adoção do CLI: comando, kit/versão resolvidos quando aplicável, sucesso/falha, duração, plataforma, arquitetura e versão do `cullet`.

---

## Quando usar full-control

Use o modo `fc` quando:

- precisa customizar o kit além do que um import direto permite
- quer versionar a cópia junto com a aplicação
- pretende adaptar a arquitetura a regras muito específicas do projeto
- quer inspecionar, debugar ou evoluir o kit localmente

Para consumo padrão, o import direto basta. Para forks de verdade, prefira `fc`.

---

## Como as versões funcionam

Cada kit é um pacote npm independente (`@cullet/<nome>`), versionado por semver e mantido no monorepo em `packages/<nome>/`.

- O `package.json` de cada kit é a versão canônica da release publicada no npm.
- `registry/index.json` (parte do pacote `cullet`) registra quais versões existem e qual é a `latest`.
- `latest` é a dist-tag npm do pacote do kit.
- Para fixar uma versão exata, fixe a versão npm do pacote do kit no seu `package.json` (ex.: `"@cullet/erp-core": "1.0.0"`).
- `cullet fc <nome>@<versão>` copia exatamente aquela versão para dentro do projeto consumidor.

Regras completas em [`kits/VERSIONING.md`](https://github.com/fabiano-eduardo/cullet/blob/main/kits/VERSIONING.md).

## API do catálogo

Além da CLI, o pacote `cullet` exporta `cullet/registry` para consumo programático em runtime:

```ts
import { listKits, loadKit, loadRegistry } from "cullet/registry";
```

Essa API retorna o registry tipado (`loadRegistry`), o resumo de cada kit (`listKits`) e, para um kit específico (`loadKit`), o `meta.json` parseado (incluindo `compatibility` e `kind`) junto com o `KIT_CONTEXT.md` estruturado em seções estáveis (`purpose`, `layers`, `key-decisions`, `extension-points`, `non-goals`).

---

## Kits atuais

- [`erp-core`](../erp-core/README.md) — núcleo de ERP com clean architecture, temporalidade, policies e rule sets. Publicado como `@cullet/erp-core`.
- [`dummy-api`](../dummy-api/README.md) — kit dummy de validação do fluxo de criação (sandbox do catálogo). Publicado como `@cullet/dummy-api`.

---

## Como contribuir com novos kits

O guia operacional completo vive em [`kits/AUTHORING.md`](https://github.com/fabiano-eduardo/cullet/blob/main/kits/AUTHORING.md). O resumo abaixo cobre só o bootstrap do scaffold.

Para criar um kit novo, use o template embutido:

```bash
npm run new-kit -- <nome-do-kit>                 # kit de biblioteca (foundation), o padrão
npm run new-kit -- <nome-do-kit> --kind tooling  # kit copy-only (ships a files/ payload)
# opcional:
npm run new-kit -- <nome-do-kit> --description "Descrição curta do kit"
```

O script copia `templates/kit/` (foundation) ou `templates/tooling-kit/` (tooling) para `packages/<nome-do-kit>/`, faz substituição de placeholders, cria um changeset inicial e atualiza `registry/index.json`. Para um kit de biblioteca, depois disso:

1. Refinar `meta.json` (`compatibility`, `philosophy`, `exports`).
2. Preencher `KIT_CONTEXT.md` com o sumário prompt-friendly real.
3. Atualizar `README.md` seguindo o template (**o que entrega**, **como começa**, **decisões tomadas**, **como evoluir**).
4. Implementar as camadas em `src/core/`.
5. Rodar `npm run validate-kits` e `npm run build`.

Estrutura resultante de um kit de biblioteca:

```text
packages/
  nome-do-kit/
    meta.json
    package.json
    README.md
    KIT_CONTEXT.md
    tsdown.config.ts
    src/
      index.ts
      version.ts
      core/
        domain/
        application/ports/
        errors/
        exceptions/
        result/
```

Um kit `tooling` substitui `src/` por um diretório `files/` com o payload a ser copiado.

---

## Desenvolvimento local

```bash
npm install
npm run build
npm run cli -- list
```

O build de `cullet` gera `dist/` com os bundles ESM da CLI e da API `cullet/registry`, além das declarações `.d.ts`. Os kits são pacotes próprios (`@cullet/<kit>`) com o próprio `dist/`; o `fc` copia o `src/` do kit a partir do `node_modules` do projeto consumidor.

A documentação é isolada do pacote npm. Para trabalhar nela localmente, instale as dependências em `docs/` (`npm --prefix docs install`) e rode `npm run docs:dev`.

## Validação de release

O release dos pacotes é automatizado via `changesets`:

1. No PR, adicione um changeset com `npm run changeset`.
2. O merge em `main` cria ou atualiza o release PR com `package.json` e `CHANGELOG.md`.
3. O merge do release PR publica no npm (com provenance) e cria a release/tag no GitHub.

Antes de publicar, rode o dry-run completo, que recompila o workspace, gera os tarballs reais com `npm pack` e valida o conteúdo publicado de cada pacote:

```bash
npm run release:dry-run
```

A decisão de empacotamento dos pacotes de kit é: tanto `dist/` quanto `src/` vão para o npm (o `src/` alimenta o `fc`), mas `*.spec.ts` e `*.test.ts` ficam fora do tarball.

Para validar a publicação em um projeto sandbox real:

```bash
./scripts/smoke-test.sh
# ou apontando para um tarball especifico:
./scripts/smoke-test.sh ./cullet-<versao>.tgz
```

O script cria um diretório temporário, roda `npm init`, instala o tarball, compila um projeto TypeScript mínimo consumindo um kit publicado e executa o resultado.
