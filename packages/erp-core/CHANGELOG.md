# @cullet/erp-core

## 1.0.5

### Patch Changes

- a2a8a02: Expand internal test coverage for previously untested or thinly-tested units: policy error mapping and policy-evaluation error kinds (`INVALID_POLICY_KEY`, `POLICY_DEFINITION_NOT_FOUND`), the conflict/serialization/idempotency error catalogs, `AppError.toJSON`, `RequestedBy`, `PolicyKey`, policy semver comparison, and the in-memory policy definition repository's eligibility filtering. No runtime or public API changes — spec files are excluded from the published package.

## 1.0.4

### Patch Changes

- bd5111e: fix(erp-core): return an error when an AND node has no child conditions

    `ConditionEvaluatorV1` now rejects empty `and` arrays the same way it already
    rejects empty `or` arrays, returning a tagged `EMPTY_AND_CONDITION` error
    instead of silently evaluating to `true`.

## 1.0.3

### Patch Changes

- a152160: Reescreve a descrição do pacote para refletir a entrega dupla do cullet — kits de biblioteca importáveis e kits de tooling copy-first via CLI — e a deixa consistente entre package.json e a saída do `cullet --help`. Só cullet entra (o package.json raiz é private, não publica). O reformat não precisa de changeset: a tarball publicada leva dist/ buildado, cuja saída não muda com a reformatação do src/.

## 1.0.2

### Patch Changes

- 7722608: erp-core declara explicitamente os lints de arquitetura em camadas; o catálogo passa a ser neutro de arquitetura.

## 1.0.1

### Patch Changes

- 69bc321: Corrige os exemplos de consumo nos READMEs dos kits: o import direto usa o nome npm com escopo (`@cullet/<kit>`) e o argumento do `npx cullet fc` é o nome do kit no registry (`erp-core`), não o nome com escopo. Adiciona a nota explicando o que o `fc` faz no `erp-core`.
