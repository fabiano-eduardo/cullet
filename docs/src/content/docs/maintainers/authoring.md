---
title: Anatomia de um kit
description: Resumo operacional para sair do scaffold e chegar a um kit publicável.
---

O guia completo de autoria vive em [kits/AUTHORING.md](https://github.com/fabiano-eduardo/cullet/blob/main/kits/AUTHORING.md). Esta página resume a trilha mínima.

## Fluxo curto

1. Rode `npm run new-kit -- <nome-do-kit> --description "..."`.
2. Preencha `meta.json`, `README.md` e `KIT_CONTEXT.md` com conteúdo real, não placeholders.
3. Implemente `core/domain`, `core/application` e as portas necessárias sem vazar runtime externo para o core.
4. Garanta specs colocadas ao lado do código (`.spec.ts`) e valide com `npm run validate-kits` e `npm run build`.

## Regras que mais quebram PR

- `KIT_CONTEXT.md` precisa das seções `Propósito`, `Camadas`, `Decisões-chave`, `Pontos de extensão` e `Não-objetivos`, além de ficar entre 200 e 400 tokens.
- `core/application/ports/` só aceita contratos puros com imports tipados.
- Se existe código em `core/domain/` ou `core/application/`, precisa existir pelo menos um `.spec.ts` colocalizado em cada área.
- `core/application/` deve expor classes com `Output` restrito a `Result<...>`.

## Próximo passo

Quando o kit estiver pronto para entrar numa release do pacote, adicione também um changeset na raiz do repositório para alimentar o release PR automatizado.