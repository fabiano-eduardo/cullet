# cullet

`cullet` e uma base acumulada de boilerplates reutilizaveis publicada como pacote npm. A ideia e simples: em vez de recriar a mesma fundacao em cada projeto, voce instala o pacote, importa o boilerplate que precisa ou copia a base para dentro da sua aplicacao quando quiser controle total.

O nome vem de "bala de cobre", uma piada com a frase "nao existe bala de prata". Talvez nao exista bala de prata, mas pode existir uma bala de cobre: um codigo base bem estruturado que voce leva entre projetos.

## Instalacao

```bash
npm install cullet
```

## Uso via import direto

O modo mais simples e consumir o boilerplate como modulo versionado do proprio pacote.

```ts
import {
  Entity,
  RuleSet,
  Timeline,
  ValueObject,
  allow,
  deny,
  type Policy,
} from "cullet/erp-core";

const customerCodeRules = new RuleSet<string>("CustomerCodeRules", [
  {
    name: "required",
    validate: (value) => {
      return value.trim().length > 0
        ? null
        : "Codigo do cliente e obrigatorio.";
    },
  },
  {
    name: "prefix",
    validate: (value) => {
      return value.startsWith("CUS-")
        ? null
        : "Codigo precisa comecar com CUS-.";
    },
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
  evaluate: (customer) => {
    return customer.toJSON().status === "draft"
      ? allow()
      : deny("Somente clientes em draft podem ser ativados.");
  },
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

Se voce quiser travar a dependencia em uma versao especifica do boilerplate, importe pelo subpath versionado:

```ts
import { Timeline } from "cullet/erp-core/1.0.0";
```

## CLI

Depois de instalar `cullet`, o binario `cullet` fica disponivel no projeto. Em geral, o fluxo mais pratico e usar `npx`.

### Listar boilerplates

```bash
npx cullet list
```

Mostra os boilerplates registrados, suas versoes e a descricao de cada um.

### Preparar uso por import

```bash
npx cullet install erp-core
```

Ou para travar em uma versao exata:

```bash
npx cullet install erp-core@1.0.0
```

O comando valida o registry e mostra como importar o boilerplate. Se voce quiser adicionar um alias local no `tsconfig.json`, use a flag `--alias`:

```bash
npx cullet install erp-core@1.0.0 --alias
```

### Full-control

```bash
npx cullet fc erp-core
```

Ou escolhendo uma versao explicita:

```bash
npx cullet fc erp-core@1.0.0
```

O modo `full-control` copia o boilerplate buildado para dentro do seu projeto em `./cullet/nome@versao/`, atualiza o alias `cullet/nome` no `tsconfig.json` e deixa o codigo local para voce editar como quiser.

Se o diretorio de destino ja existir, o CLI pergunta antes de sobrescrever.

## Quando usar full-control

Use o modo `full-control` quando:

- voce precisa customizar o boilerplate alem do que um import direto permite
- voce quer versionar a copia junto com a sua aplicacao
- voce pretende adaptar a arquitetura base a regras muito especificas do projeto
- voce quer inspecionar, debugar ou evoluir o boilerplate localmente

Para consumo padrao, o import direto costuma ser suficiente. Para forks de verdade, prefira `full-control`.

## Como as versoes funcionam

Cada boilerplate fica organizado em `boilerplates/<nome>/versions/<versao>/`.

- `registry/index.json` registra quais versoes existem e qual e a latest
- `cullet/<nome>` sempre aponta para a versao latest exportada pelo pacote
- `cullet/<nome>/<versao>` fixa o consumo em uma versao exata
- `cullet fc <nome>@<versao>` copia exatamente aquela versao para dentro do projeto consumidor

## Boilerplates atuais

### erp-core

Descricao: core ERP com clean architecture, temporalidade, policies e rule sets.

Nesta versao inicial do pacote, o `erp-core` existe como superficie versionada e tipada para integracao do `cullet`. O aprofundamento do boilerplate continua evoluindo separadamente.

## Como contribuir com novos boilerplates

Todo boilerplate novo deve seguir a mesma convencao estrutural:

```text
boilerplates/
  nome-do-boilerplate/
    versions/
      1.0.0/
        index.ts
        meta.json
        core/
          ...
      latest/
        index.ts
```

Checklist esperado para uma contribuicao:

- adicionar a nova pasta em `boilerplates/<nome>/versions/<versao>/`
- criar `meta.json` com nome, versao, entrypoint, exports, changelog e deprecated
- atualizar `registry/index.json` com a nova versao e o ponteiro `latest`
- garantir que o `index.ts` exporta a superficie publica do boilerplate
- validar o build do pacote e o funcionamento do CLI

## Desenvolvimento local

```bash
npm install
npm run build
npm run cli -- list
```

O build gera `dist/` com os bundles ESM, as declaracoes `.d.ts` e tambem replica os fontes dos boilerplates para suportar o modo `full-control`.
