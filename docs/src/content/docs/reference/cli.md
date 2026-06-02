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

Mostra a versão escolhida, a matriz `compatibility` declarada em `meta.json` (Node, TypeScript e peer deps do import direto), instruções de import e um resumo do `KIT_CONTEXT.md`.

## `cullet fc <kit>`

```bash
npx cullet fc erp-core
npx cullet fc erp-core@1.0.0
npx cullet fc erp-core@1.0.0 --dry-run
```

Para um kit de biblioteca (`foundation` / `capability`), copia o kit para `./cullet/<nome>@<versão>/`, ajusta o alias `cullet/<nome>` no `tsconfig.json` e avisa sobre `compatibility.fullControl.dependencies`, com ranges, que precisam ser instaladas manualmente.

Para um kit `tooling`, copia o payload `files/` para o `placement` declarado em `meta.json` (ex.: `.claude/`), mesclando com o conteúdo existente — sem alias de `tsconfig`. É o caminho para adicionar um harness ou conjunto de configs a um projeto em andamento. Dependências externas, quando houver, vêm de `delivery.copy.dependencies`.

Use `--dry-run` para inspecionar destino, amostra de arquivos e alias (ou placement) sem escrever nada.

Quando o destino já existe, o overwrite usa staging + backup temporário antes do swap final. Se a cópia falhar no meio, o diretório anterior é restaurado.

## `cullet migrate <kit>`

```bash
npx cullet migrate erp-core@1.0.0
npx cullet migrate erp-core@1.0.0 --dry-run
npx cullet migrate erp-core@1.0.0 --apply
```

Lê o caminho de migração codificado em `meta.json -> deprecated.successor`, imprime o sucessor recomendado e, quando existirem, o guia de migração e o codemod associado.

-   sem flags: só mostra o plano;
-   `--dry-run`: executa o codemod em simulação;
-   `--apply`: aplica o codemod no diretório atual ou no `--cwd` informado.

`--dry-run` e `--apply` carregam e executam o codemod publicado pelo kit no processo do CLI. Use essas flags apenas para kits e versões cuja origem você confia e revisou.

## `cullet doctor`

```bash
npx cullet doctor
```

Audita o projeto consumidor e retorna `exit code 1` quando encontra erros incompatíveis com o consumo do pacote.

## Telemetria

```bash
npx cullet telemetry status
npx cullet telemetry enable
npx cullet telemetry enable --endpoint https://telemetry.example.dev/events
npx cullet telemetry disable
```

Telemetria do CLI é opt-in. Quando habilitada, cada comando grava um evento anônimo em log local e, opcionalmente, exporta o mesmo payload por HTTPS `POST` para um endpoint configurado. Endpoints sem `https://` são rejeitados.

O payload é intencionalmente mínimo:

-   comando executado;
-   kit e versão resolvida, quando houver;
-   duração e sucesso/falha;
-   plataforma, arquitetura, versão do Node e versão do CLI.
