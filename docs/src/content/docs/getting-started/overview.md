---
title: Visão geral
description: Como instalar o cullet e escolher entre import direto e full-control.
---

`cullet` publica blocos arquiteturais opinativos para TypeScript. Cada kit declara em `meta.json` o seu `kind`:

- **`foundation` / `capability`** — kits de biblioteca importáveis, com decisões já tomadas sobre erros, observabilidade, testes, resiliência e manutenibilidade. Consumidos por import direto ou cópia full-control (os dois modos abaixo).
- **`tooling`** — kits copy-only (harness, configs, scripts). Não são importáveis: o `npx cullet fc <kit>` mescla o payload num placement do projeto (ex.: `.claude/`), o que permite adicioná-los a qualquer momento, inclusive a um projeto em andamento.

## Instalação

```bash
npm install cullet
npx cullet doctor
```

O `doctor` valida o cenário mínimo do projeto consumidor: `moduleResolution`, `type: module`, `baseUrl` quando há `paths`, e a versão do TypeScript testada pelo catálogo.

## Dois modos de consumo (kits de biblioteca)

Estes dois modos valem para kits `foundation` / `capability`. Kits `tooling` têm só um caminho: `npx cullet fc <kit>`, que copia o payload para o placement, sem import nem alias.

| Aspecto | Import direto | Full-control |
| --- | --- | --- |
| Import | `cullet/<kit>` | `npx cullet fc <kit>@<versão>` |
| Onde o código vive | `node_modules/cullet/dist/kits/...` | `./cullet/<kit>@<versão>/` dentro do seu projeto |
| Atualização | `npm update cullet` | você mantém o fork local |
| Customização | composição em volta da API pública | edição livre do kit copiado |

O import do consumidor continua o mesmo depois da cópia full-control. O que muda é o alvo do alias em `tsconfig.json`.

## Quando escolher cada um

- Fique no import direto quando a API publicada do kit já resolve o problema e você quer upgrade simples.
- Migre para full-control quando precisar abrir o kit, adaptar o design interno ou manter o código junto da aplicação.

## Próximas leituras

- [CLI](/reference/cli/) para os comandos disponíveis.
- [Versionamento](/reference/versioning/) para entender a diferença entre versão do pacote e versão do kit.
- [erp-core](/kits/erp-core/) para ver um kit real do catálogo.