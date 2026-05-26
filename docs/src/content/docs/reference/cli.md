---
title: CLI
description: Comandos principais do cullet para consumidores e mantenedores.
---

O caminho prático para o CLI é `npx cullet ...`.

## `cullet list`

```bash
npx cullet list
```

Lista os kits registrados, suas versões, descrições e eventuais marcações de deprecação.

## `cullet info <kit>`

```bash
npx cullet info erp-core
npx cullet info erp-core@1.0.0
npx cullet info erp-core --full
npx cullet info erp-core --alias
```

Mostra a versão escolhida, dependências externas declaradas em `meta.json`, instruções de import e um resumo do `KIT_CONTEXT.md`.

## `cullet fc <kit>`

```bash
npx cullet fc erp-core
npx cullet fc erp-core@1.0.0
npx cullet fc erp-core@1.0.0 --dry-run
```

Copia o kit para `./cullet/<nome>@<versão>/`, ajusta o alias `cullet/<nome>` no `tsconfig.json` e avisa sobre dependências externas que precisam ser instaladas manualmente.

Use `--dry-run` para inspecionar destino, amostra de arquivos e alias sem escrever nada.

## `cullet doctor`

```bash
npx cullet doctor
```

Audita o projeto consumidor e retorna `exit code 1` quando encontra erros incompatíveis com o consumo do pacote.

## Telemetria

Não há telemetria ativa no CLI hoje. A coleta permanece explicitamente fora do escopo até existir um desenho opt-in fechado para transporte, retenção e divulgação do dado coletado.