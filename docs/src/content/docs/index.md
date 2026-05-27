---
title: cullet
description: Catálogo de kits arquiteturais opinativos para TypeScript.
template: splash
hero:
  title: Bala de cobre para arquiteturas TypeScript
  tagline: Kits curados, versionados e utilizáveis por import direto ou full-control, sem abrir mão de contratos explícitos e evolução previsível.
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

- Um CLI para listar kits, inspecionar contexto, validar o projeto consumidor e copiar um kit para modo full-control.
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
