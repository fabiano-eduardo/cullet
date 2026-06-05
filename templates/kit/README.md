# **KIT_NAME**

**KIT_DESCRIPTION**

Para o sumário prompt-friendly do kit veja [`KIT_CONTEXT.md`](./KIT_CONTEXT.md). Para os contratos comuns a todos os kits veja a [`PHILOSOPHY.md`](../../PHILOSOPHY.md) do repositório.

---

## O que entrega

Substitua esta seção pela descrição concreta do que vem dentro do kit:

- principais primitives expostas em `index.ts`
- como o `src/` está organizado (as fronteiras que o kit usa — camadas, módulos, slices, …)
- limites: o que está pronto, o que é só esqueleto

## Como começa

```ts
import {} from /* primitives */ "@cullet/__KIT_NAME__";
```

Se preferir o modo full-control:

```bash
npx cullet fc __KIT_NAME__@1.0.0
```

O comando copia o kit para `./cullet/__KIT_NAME__@1.0.0/` e registra o alias `@cullet/__KIT_NAME__` no seu `tsconfig.json`.

## Decisões tomadas

- **Modelo de erro**: `mixed` — falha previsível volta como `Result<T, E>`; violação de invariante lança exceção tipada; integração externa traduz para `Result`. (Ajuste em `meta.json` se o kit usar outro modelo.)
- **Observabilidade**: exposta só por contratos injetáveis, sem dependência runtime de lib de log/trace.
- **Validação**: entrada externa validada uma única vez na borda; o núcleo assume input já válido em tipo.
- Adicione aqui as decisões específicas deste kit (estrutura adotada, regras de lint ligadas, convenções de naming, opções deliberadamente excluídas).

## Como evoluir

Descreva onde adicionar comportamento conforme as fronteiras do seu `src/`. (Exemplo para um kit em camadas: novos casos de uso vão na camada de aplicação consumindo portas; novos contratos/adapters mantêm a porta livre de runtime externo.)

- **Mudança incompatível**: abra um changeset e publique uma nova major do pacote. Regras completas em [`kits/VERSIONING.md`](../../kits/VERSIONING.md).
- **Antes de publicar**: rode `npm run validate-kits` para garantir que o kit ainda respeita a filosofia.
