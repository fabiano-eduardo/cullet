# Changelog

## 0.5.6

### Patch Changes

- 8f19d99: test(cli): expand regression coverage around full-control and registry helpers, and align workspace metadata with the `packages/*` monorepo layout.

## 0.5.5

### Patch Changes

- 72387ff: fix(cli): permitir o auto-install do `fc` no Windows (CVE-2024-27980)

    `installPackage` fazia spawn de `npm.cmd`/`pnpm.cmd`/`yarn.cmd` via `execFile`
    sem `shell: true`, o que lança `EINVAL` no Node >= 18.20.2/20.12.2 (correcao da
    CVE-2024-27980) e quebrava `cullet fc <kit>` com auto-install no Windows. O
    spawn passa a habilitar o shell apenas no Windows (espelhando `npm-registry.ts`),
    com uma allow-list que rejeita specs de instalacao com metacaracteres de shell
    antes de spawnar.

## 0.5.4

### Patch Changes

- 7a24878: fix(cli): blindar a telemetria contra falhas de ambiente e nunca quebrar o comando

    Em ambientes sem `HOME` (Windows nativo, onde o Node usa `USERPROFILE`; containers/CI sem
    `HOME`), resolver o diretório de telemetria lançava erro e **todo comando** — mesmo com a
    telemetria desligada por padrão — terminava com exit 1 logo após imprimir a saída. O
    diretório do usuário passa a ser resolvido por `HOME` → `USERPROFILE` → `os.homedir()`.

    Além disso, o registro e a exportação do evento agora são estritamente best-effort no
    wrapper de comando: qualquer falha de telemetria (escrita local, rede ou resolução de
    caminho) é contida e jamais quebra o comando nem mascara o erro real do handler.

    Internamente o módulo de telemetria foi fragmentado em arquivos menores e coesos
    (`telemetry/{types,errors,paths,endpoint,diagnostics,store,transport}.ts`), sem mudança de
    comportamento nem da superfície pública.

## 0.5.3

### Patch Changes

- 542137c: fix(cli): consultar o npm via shell no Windows e blindar `npm view` contra injeção

    No Windows o executável é `npm.cmd`; desde o patch de CVE do Node, `.cmd`/`.bat` só
    podem ser spawnados com `shell: true`. Sem isso, `fetchPublishedPackageInfo` falhava
    silenciosamente no Windows e o recurso de versões publicadas nunca funcionava. Agora o
    shell é habilitado apenas no Windows. Como isso reintroduz risco de injeção de comando,
    o nome do pacote passa a ser validado contra um allow-list de caracteres válidos de
    nome npm antes de qualquer spawn.

## 0.5.2

### Patch Changes

- 910e3f3: fix(cli): resolver `npm`/`pnpm`/`yarn` como `.cmd` no Windows ao instalar kits

    `installPackage` usava `execFile` com o nome puro do gerenciador. Como `execFile`
    não passa por shell, no Windows os binários (`npm.cmd` etc.) não eram resolvidos
    e o comando falhava com `ENOENT`. Agora o executável é resolvido por plataforma.

## 0.5.1

### Patch Changes

- fd137b4: fix(doctor): reportar um `tsconfig.json` ilegível como finding dedicado.

    Quando o projeto tem um `tsconfig.json` presente mas com sintaxe inválida, o
    `cullet doctor` deixava a exceção de leitura subir e abortar o comando. Agora
    ele captura a falha e registra um finding de erro `tsconfig-unreadable`, com uma
    dica para corrigir a sintaxe, seguindo auditando o restante do projeto.

## 0.5.0

### Minor Changes

- 8f7aad1: Remove o comando `cullet migrate` e os caminhos legados de resolução de kits
  (`kits/<name>/versions/<v>/` e `dist/kits/<name>/versions/<v>/`).

    O layout canônico passa a ser a única fonte de resolução: no repositório os kits
    são lidos de `packages/<name>/`, e no pacote publicado a resolução para
    full-control caminha pelo `node_modules` do consumidor. O `migrate` dependia
    exclusivamente do layout versionado antigo — que não existe mais —, então já era
    vestigial. Também foram removidos `resolveBuiltKitDir`, `kitDistEntryRelative` e
    o aviso de divergência de metadados `src`↔`dist`, todos atrelados a esse layout.

## 0.4.1

### Patch Changes

- a152160: Reescreve a descrição do pacote para refletir a entrega dupla do cullet — kits de biblioteca importáveis e kits de tooling copy-first via CLI — e a deixa consistente entre package.json e a saída do `cullet --help`. Só cullet entra (o package.json raiz é private, não publica). O reformat não precisa de changeset: a tarball publicada leva dist/ buildado, cuja saída não muda com a reformatação do src/.

## 0.4.0

### Minor Changes

- 6dea1f2: Expose an à la carte registry API and dogfood it from the CLI: `loadKit` now accepts `{ context?: boolean }` and `CatalogKit` includes `npmName`. Internally, `catalog.ts` was split into focused modules and kit-arg parsing was deduplicated. No CLI behavior change.

## 0.3.1

### Patch Changes

- a5731c8: Sincroniza o catálogo da CLI (`packages/cli/registry/index.json`) com `@cullet/erp-core@1.0.2`. O release anterior bumpou o kit mas deixou o registry em `1.0.1`; com isso, `cullet list`/`info` voltam a reportar a versão correta.

## 0.3.0

### Minor Changes

- 69bc321: Kits `tooling` agora podem opcionalmente expor uma superfície importável (`entryPoint` + `delivery.import`), consumível direto do node_modules sem cópia. `cullet info` mostra os dois caminhos (import direto e `fc`) e `--alias` passa a funcionar para esses kits; `cullet fc` avisa quando o kit também é importável; e `validate-kit` exige um `entryPoint` existente quando `delivery.import` é declarado. Kits copy-only seguem inalterados.
- 69bc321: Adiciona o `kind` **tooling**: kits copy-only que declaram `delivery.copy` (placement + payload `files/`) e são mesclados no projeto por `npx cullet fc <kit>`, sem import nem alias de tsconfig. `cullet info`/`list` reconhecem o kind, `validate-kit` aplica o contrato condicional por kind (kits de biblioteca exigem `entryPoint`/`philosophy`/`compatibility`; kits tooling exigem `delivery.copy`), e o `npm run new-kit -- <nome> --kind tooling` faz o scaffold a partir de `templates/tooling-kit/`.

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.0] — 2026-05-25 — First public release

First public (early-access / beta) release of the cullet catalog.

### Added

- `erp-core@1.0.0` — clean-architecture core for ERP domains: `Entity`, `ValueObject`,
  `Timeline`, `RuleSet`, `Policy`, structured error hierarchy, and Zod-based validation.
- `dummy-api@1.0.0` — minimal kit used to validate the full catalog pipeline end-to-end.
- CLI commands: `cullet list`, `cullet doctor`, `cullet fc <kit>@<version>`,
  `cullet info <kit>[@<version>]`.
- Dual consumption model: _import direto_ (`cullet/<kit>`) and _full-control_
  (`npx cullet fc <kit>@<version>` copies the kit source into the consumer project).
- npm provenance publishing via GitHub Actions OIDC (`npm publish --provenance`).
- Automated release workflow (`.github/workflows/release.yml`) triggered by `v*` tags:
  typecheck → tests → pack-validate → publish → GitHub Release.

[Unreleased]: https://github.com/fabiano-eduardo/cullet/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/fabiano-eduardo/cullet/releases/tag/v0.2.0
