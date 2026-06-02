---
title: cullet
description: Catálogo opinativo de blocos arquiteturais e ferramentas para TypeScript.
template: splash
hero:
  title: Bala de cobre para projetos TypeScript
  tagline: Kits curados e versionados — de bibliotecas importáveis a harness e ferramentas copy-only — que você adota do zero ou pluga num projeto em andamento, sem abrir mão do controle total.
  image:
    file: ../../assets/cullet-mark.svg
    alt: Marca do cullet
  actions:
    - text: Começar
      link: /getting-started/overview/
    - text: Anatomia de um kit
      link: /maintainers/authoring/
---

## O que já está pronto

- Duas famílias de kit declaradas por `kind`: kits de biblioteca (`foundation` / `capability`), importáveis ou copiáveis, e kits `tooling` copy-only que se mesclam num placement do projeto (ex.: `.claude/`).
- Um CLI para listar kits, inspecionar contexto, validar o projeto consumidor e copiar um kit (biblioteca ou tooling) para dentro do projeto.
- Um catálogo versionado por kit, com `latest` e subpaths pinados (`cullet/<kit>/<versão>`).
- Um fluxo de release automatizado por `changesets`, no qual PRs carregam a intenção de release e o merge publica sem terminal humano.

## Como navegar

- Comece por [Visão geral](/getting-started/overview/) se você quer consumir um kit.
- Vá para [CLI](/reference/cli/) se precisa integrar o `cullet doctor`, `info` ou `fc` na sua rotina.
- Use [Anatomia de um kit](/maintainers/authoring/) se a meta é publicar ou evoluir um kit do catálogo.

## Estado do catálogo

- [`erp-core`](/kits/erp-core/) é o kit real de referência: domínio, aplicação, policies, timeline e contratos de observabilidade.
- [`dummy-api`](/kits/dummy-api/) é o sandbox do pipeline de catálogo, útil para testar o fluxo de scaffold, validação e empacotamento.
- O CLI agora expõe telemetria opt-in: log local sempre, export HTTP opcional e payload mínimo focado em adoção de comandos/kits.
