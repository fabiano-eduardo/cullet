# dummy-api

Kit de exemplo mínimo do cullet: um esqueleto de core em clean architecture que serve de referência de estrutura para começar um novo kit. Não expõe uma API de negócio própria — é o ponto de partida estrutural, não um kit de produção.

Para o sumário prompt-friendly veja [`KIT_CONTEXT.md`](./KIT_CONTEXT.md). Para os contratos comuns a todos os kits veja a [`PHILOSOPHY.md`](../../../../PHILOSOPHY.md).

---

## O que entrega

- Esqueleto de pastas `core/domain/`, `core/exceptions/`, `core/errors/`, `core/result/`, `core/application/` — ainda sem primitives implementadas.
- `meta.json`, `KIT_CONTEXT.md` e `index.ts` válidos contra `kit-spec.schema.json`.
- Serve como referência ao rodar `npm run new-kit` e como teste de regressão para o `validate-kits`.

## Como começa

```ts
import {} from /* nada exportado ainda */ "@cullet/dummy-api";
```

Para inspecionar a estrutura sem instalar:

```bash
npx cullet fc dummy-api@1.0.0 --dry-run
```

## Decisões tomadas

- **Modelo de erro `mixed`**: estabelecido por contrato do catálogo — mesmo neste kit de exemplo, a estrutura segue a filosofia (domínio lança, aplicação retorna `Result`, infra traduz).
- **Sem dependência runtime externa**: `externalDeps: []`. Qualquer dep nova exige justificativa no `KIT_CONTEXT.md`.
- **Sem portas implementadas**: a expectativa é evoluir o kit antes de qualquer consumidor real usá-lo.

## Como evoluir

- Ajustar `meta.json` e `KIT_CONTEXT.md` ao adaptar o esqueleto para um problema-alvo real.
- Preencher `core/domain/`, `core/application/`, `core/errors/`, `core/exceptions/` à medida que o problema-alvo se definir.
- Mudança incompatível: abrir `versions/2.0.0/`. Regras em [`kits/VERSIONING.md`](../../../../kits/VERSIONING.md).
- Antes de qualquer publicação: `npm run validate-kits`.
