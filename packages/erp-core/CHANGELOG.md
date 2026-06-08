# @cullet/erp-core

## 1.0.3

### Patch Changes

- a152160: Reescreve a descrição do pacote para refletir a entrega dupla do cullet — kits de biblioteca importáveis e kits de tooling copy-first via CLI — e a deixa consistente entre package.json e a saída do `cullet --help`. Só cullet entra (o package.json raiz é private, não publica). O reformat não precisa de changeset: a tarball publicada leva dist/ buildado, cuja saída não muda com a reformatação do src/.

## 1.0.2

### Patch Changes

- 7722608: erp-core declara explicitamente os lints de arquitetura em camadas; o catálogo passa a ser neutro de arquitetura.

## 1.0.1

### Patch Changes

- 69bc321: Corrige os exemplos de consumo nos READMEs dos kits: o import direto usa o nome npm com escopo (`@cullet/<kit>`) e o argumento do `npx cullet fc` é o nome do kit no registry (`erp-core`), não o nome com escopo. Adiciona a nota explicando o que o `fc` faz no `erp-core`.
