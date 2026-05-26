---
title: Visão geral
description: Como instalar o cullet e escolher entre import direto e full-control.
---

`cullet` publica kits arquiteturais opinativos para TypeScript. Cada kit chega com decisões já tomadas sobre erros, observabilidade, testes, resiliência e manutenibilidade.

## Instalação

```bash
npm install cullet
npx cullet doctor
```

O `doctor` valida o cenário mínimo do projeto consumidor: `moduleResolution`, `type: module`, `baseUrl` quando há `paths`, e a versão do TypeScript testada pelo catálogo.

## Dois modos de consumo

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