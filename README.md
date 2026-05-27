# cullet

`cullet` é uma coleção de kits arquiteturais opinativos para TypeScript, publicada como pacote npm. Cada kit entrega uma arquitetura completa e curada para um tipo específico de problema, com decisões já tomadas sobre gestão de erros, observabilidade, testes, resiliência, segurança e manutenibilidade.

O nome vem de "bala de cobre", uma piada com a frase "não existe bala de prata". Talvez não exista bala de prata, mas pode existir uma bala de cobre: não a solução perfeita universal, mas a arquitetura certa para o problema certo. `cullet` não é framework, não é biblioteca, não é gerador de código — é uma curadoria de arquiteturas prontas para quem não quer começar do zero, mas quer controle total desde o primeiro dia.

A filosofia completa (modelo de erros, observabilidade, testes, resiliência, segurança, manutenibilidade) vive em [`PHILOSOPHY.md`](./PHILOSOPHY.md). As regras de versionamento em [`kits/VERSIONING.md`](./kits/VERSIONING.md).

A documentação navegável vive em [`docs/`](./docs) e é publicada no GitHub Pages do projeto. Para trabalhar nela localmente, instale as dependências em `docs/` e rode `npm run docs:dev`.

---

## Instalação

```bash
npm install cullet
```

Antes de importar qualquer kit, rode o doctor para validar o tsconfig e o package.json do seu projeto:

```bash
npx cullet doctor
```

Ele aponta problemas comuns: `moduleResolution` incompatível, `"type": "module"` ausente, `paths` sem `baseUrl`, TypeScript abaixo da versão mínima testada.

---

## Os dois modos, lado a lado

O `cullet` tem dois modos de consumo. Eles **não são exclusivos**: você pode começar via import direto e migrar um kit específico para full-control quando precisar customizar.

| Aspecto               | **Import direto** (`cullet/<kit>`)              | **Full-control** (`npx cullet fc <kit>`)                                         |
| --------------------- | ----------------------------------------------- | -------------------------------------------------------------------------------- |
| Onde o código vive    | Em `node_modules/cullet/dist/kits/...`          | Copiado para `./cullet/<kit>@<versão>/` dentro do seu projeto                    |
| Como atualiza         | `npm update cullet` traz versões novas          | Não atualiza sozinho — é seu fork local                                          |
| Quando customizar     | Forks via composição em volta da API exportada  | Você edita o kit livremente como código próprio                                  |
| Como o TS resolve     | Subpath export `cullet/<kit>` no `package.json` | Alias `cullet/<kit>` em `tsconfig.json` apontando para `./cullet/<kit>@<v>/`     |
| Dependências externas | Declaradas como `peerDependencies` do `cullet`  | **Você instala manualmente** — o `package.json` do `cullet` deixa de influenciar |

### Exemplo lado a lado

O bloco abaixo é o mesmo código sob os dois modos. A única diferença está no import.

**Import direto** — instalou, importou, usou:

```ts
// modo: import direto
import {
  Entity,
  RuleSet,
  Timeline,
  ValueObject,
  allow,
  deny,
  type Policy,
} from "cullet/erp-core";
```

**Full-control** — depois de `npx cullet fc erp-core@1.0.0`:

```ts
// modo: full-control (alias cullet/erp-core -> ./cullet/erp-core@1.0.0/index.ts)
import {
  Entity,
  RuleSet,
  Timeline,
  ValueObject,
  allow,
  deny,
  type Policy,
} from "cullet/erp-core";
```

O código de aplicação é idêntico:

```ts
const customerCodeRules = new RuleSet<string>("CustomerCodeRules", [
  {
    name: "required",
    validate: (value) =>
      value.trim().length > 0 ? null : "Código do cliente é obrigatório.",
  },
  {
    name: "prefix",
    validate: (value) =>
      value.startsWith("CUS-") ? null : "Código precisa começar com CUS-.",
  },
]);

class CustomerCode extends ValueObject<string> {
  private constructor(value: string) {
    super(value);
  }

  static create(value: string): CustomerCode {
    customerCodeRules.assert(value);
    return new CustomerCode(value);
  }
}

type CustomerProps = {
  code: CustomerCode;
  name: string;
  status: "draft" | "active";
};

class Customer extends Entity<string, CustomerProps> {
  private constructor(id: string, props: CustomerProps) {
    super(id, props);
  }

  static create(id: string, code: string, name: string): Customer {
    return new Customer(id, {
      code: CustomerCode.create(code),
      name,
      status: "draft",
    });
  }

  activate(): void {
    this.mutate({ status: "active" });
  }
}

const canActivateCustomer: Policy<Customer> = {
  name: "can-activate-customer",
  evaluate: (customer) =>
    customer.toJSON().status === "draft"
      ? allow()
      : deny("Somente clientes em draft podem ser ativados."),
};

const statusTimeline = new Timeline<CustomerProps["status"]>([
  { at: "2026-01-10", value: "draft" },
]);

const customer = Customer.create("customer-1", "CUS-0001", "Loja Aurora");
const decision = canActivateCustomer.evaluate(customer);

if (decision.allowed) {
  customer.activate();
  statusTimeline.append("active", new Date("2026-01-12"));
}
```

> Quer pinar em uma versão exata? Use o subpath versionado:
>
> ```ts
> import { Timeline } from "cullet/erp-core/1.0.0";
> ```

---

## CLI

Depois de instalar `cullet`, o binário fica disponível no projeto. Em geral, o fluxo mais prático é via `npx`.

### `cullet list`

```bash
npx cullet list
```

Lista os kits do registry, suas versões, descrições e deprecações.

### `cullet info <kit>`

```bash
npx cullet info erp-core
npx cullet info erp-core@1.0.0
npx cullet info erp-core --full   # KIT_CONTEXT.md integral, sem resumir
npx cullet info erp-core --alias  # cria alias cullet/erp-core no tsconfig
```

Valida o kit no registry, mostra como importar, lista as dependências externas declaradas no `meta.json` e exibe um resumo do `KIT_CONTEXT.md` — a janela direta para decidir se o kit cabe no seu projeto.
Valida o kit no registry, mostra como importar, lista a matriz de compatibilidade declarada no `meta.json` (`compatibility.engines` e `compatibility.directImport.peerDependencies`) e exibe um resumo do `KIT_CONTEXT.md` estruturado — a janela direta para decidir se o kit cabe no seu projeto.

### `cullet fc <kit>`

```bash
npx cullet fc erp-core
npx cullet fc erp-core@1.0.0
npx cullet fc erp-core@1.0.0 --dry-run
```

Copia o kit para `./cullet/<nome>@<versão>/` e atualiza o alias `cullet/<nome>` no `tsconfig.json`. Avisa se o seu `baseUrl` não é `"."` (porque o `paths` é resolvido relativo a `baseUrl`) e lista `compatibility.fullControl.dependencies`, com ranges, que você precisa instalar manualmente — no full-control, as `peerDependencies` do `cullet` deixam de influenciar: o Node passa a resolver imports pelo `node_modules` do seu projeto.

Com `--dry-run`, o CLI mostra o destino, uma amostra dos arquivos que seriam copiados e o alias resultante, sem escrever nada.

Se o destino já existir e você estiver em modo real, o CLI pede confirmação antes de sobrescrever. A troca é transacional: o conteúdo antigo vai para backup temporário e só sai de cena quando a nova cópia assume o lugar, então falhas no meio não deixam o projeto em estado parcialmente sobrescrito.

### `cullet migrate <kit>`

```bash
npx cullet migrate erp-core@1.0.0
npx cullet migrate erp-core@1.0.0 --dry-run
npx cullet migrate erp-core@1.0.0 --apply
```

Lê o caminho de migração declarado em `meta.json -> deprecated.successor`, mostra o sucessor recomendado, o guia de migração e o codemod associado quando existirem. Sem flags, só imprime o plano. Com `--dry-run`, executa o codemod em modo simulado. Com `--apply`, executa a migração no diretório atual.

### `cullet doctor`

```bash
npx cullet doctor
```

Audita o projeto consumidor procurando configurações incompatíveis com o `cullet`:

- `tsconfig.json` com `moduleResolution` que não respeita os `exports` do pacote (`node`, `node10`, `classic`).
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

Telemetria agora é explicitamente opt-in. Quando habilitada, cada execução de comando grava um evento anônimo em um log local (`events.ndjson`) e, opcionalmente, envia o mesmo payload por HTTP `POST` para um endpoint configurado. O payload contém apenas dados de adoção do CLI: comando, kit/versão resolvidos quando aplicável, sucesso/falha, duração, plataforma, arquitetura e versão do `cullet`.

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

Cada kit fica organizado em `kits/<nome>/versions/<versão>/`.

- `registry/index.json` registra quais versões existem e qual é a `latest`.
- `cullet/<nome>` sempre aponta para a `latest` exportada pelo pacote.
- `cullet/<nome>/<versão>` fixa o consumo em uma versão exata.
- `cullet fc <nome>@<versão>` copia exatamente aquela versão para dentro do projeto consumidor.

Regras completas em [`kits/VERSIONING.md`](./kits/VERSIONING.md).

## API do catálogo

Além dos kits, o pacote também exporta `cullet/registry` para consumo programático em runtime:

```ts
import { listKits, loadKit, loadRegistry } from "cullet/registry";
```

Essa API retorna o registry tipado, o `meta.json` parseado (incluindo `compatibility`) e o `KIT_CONTEXT.md` estruturado em seções estáveis (`purpose`, `layers`, `key-decisions`, `extension-points`, `non-goals`).

---

## Kits atuais

- [`erp-core`](./kits/erp-core/versions/1.0.0/README.md) — núcleo de ERP com clean architecture, temporalidade, policies e rule sets.
- [`dummy-api`](./kits/dummy-api/versions/1.0.0/README.md) — kit dummy de validação do fluxo de criação (sandbox do catálogo).

---

## Como contribuir com novos kits

O guia operacional completo vive em [`kits/AUTHORING.md`](./kits/AUTHORING.md). O resumo abaixo cobre só o bootstrap do scaffold.

Para criar um kit novo, use o template embutido:

```bash
npm run new-kit -- <nome-do-kit>
# opcional:
npm run new-kit -- <nome-do-kit> --description "Descrição curta do kit"
```

O script copia `templates/kit/` para `kits/<nome>/versions/1.0.0/`, faz substituição de placeholders e atualiza `registry/index.json`. Depois disso:

1. Refinar `meta.json` (`compatibility`, `philosophy`, `exports`).
2. Preencher `KIT_CONTEXT.md` com o sumário prompt-friendly real.
3. Atualizar `README.md` seguindo o template (**o que entrega**, **como começa**, **decisões tomadas**, **como evoluir**).
4. Implementar as camadas em `core/`.
5. Rodar `npm run validate-kits` e `npm run build`.

Estrutura resultante:

```text
kits/
  nome-do-kit/
    versions/
      1.0.0/
        index.ts
        meta.json
        README.md
        KIT_CONTEXT.md
        core/
          domain/
          application/ports/
          errors/
          exceptions/
          result/
```

---

## Desenvolvimento local

```bash
npm install
npm run build
npm run cli -- list
npm run docs:build
```

O build gera `dist/` com bundles ESM, declarações `.d.ts` e os fontes dos kits replicados para suportar o modo `fc`.

O site de docs é isolado do pacote npm. Na primeira vez, rode também `npm --prefix docs install`.

## Validação de release

O release do pacote agora é automatizado via `changesets`:

1. No PR, adicione um changeset com `npm run changeset`.
2. O merge em `main` cria ou atualiza o release PR com `package.json` e `CHANGELOG.md`.
3. O merge do release PR publica no npm e cria a release/tag no GitHub.

Antes de publicar, rode o dry-run completo do pacote:

```bash
npm run release:dry-run
```

Esse fluxo recompila o projeto, gera um tarball real com `npm pack` e valida o conteúdo publicado. A decisão de empacotamento é: `dist/kits/` vai para o npm, mas `*.spec.ts` e `*.test.ts` ficam fora do tarball.

Para validar o pacote em um projeto sandbox real:

```bash
./scripts/smoke-test.sh
# ou apontando para um tarball especifico:
./scripts/smoke-test.sh ./cullet-<versao>.tgz
```

O script cria um diretório temporário, roda `npm init`, instala o tarball, compila um projeto TypeScript mínimo com `cullet/erp-core` e executa o resultado.
