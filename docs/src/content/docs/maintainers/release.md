---
title: Release
description: Fluxo automatizado de versionamento, changelog e publicação do pacote.
---

O catálogo agora usa `changesets` como fonte de verdade da intenção de release.

## Fluxo de ponta a ponta

1. Cada PR relevante adiciona um arquivo em `.changeset/`.
2. A CI falha em PR sem changeset, a menos que o mantenedor use um changeset vazio para uma mudança sem release.
3. O merge em `main` atualiza ou cria o release PR com `package.json` e `CHANGELOG.md` versionados.
4. O merge do release PR dispara publish para npm com provenance e cria as tags/releases no GitHub via `changesets/action`.

## O que continua manual

- Revisar o conteúdo do changeset no PR.
- Aprovar e dar merge no release PR.
- Manter o segredo `NPM_TOKEN` configurado no repositório.

## O que saiu do terminal humano

- Bump manual de versão em `package.json`.
- Edição manual de `CHANGELOG.md`.
- Criação manual de tag `v*` para disparar publish.

## Telemetria do CLI

Continua deliberadamente desativada. Antes de implementar qualquer coleta opt-in, o projeto ainda precisa fechar a política de consentimento, payload mínimo, retenção e exposição pública desses dados.