# Versionamento e descontinuação de kits

Este documento fixa as regras que todo kit do catálogo `cullet` segue para evoluir sem quebrar consumidores existentes. As regras são curtas, opinativas e auditáveis pelo `npm run validate-kits`.

## 1. SemVer aplicado ao kit, não ao pacote

Cada kit tem **sua própria versão SemVer**, independente da versão do pacote npm `cullet`. No workspace, a versão canônica do kit vive em `packages/<nome>/package.json`; `packages/<nome>/meta.json` repete o mesmo valor para o catálogo, e `registry/index.json` segue registrando `versions` e `latest`.

- **MAJOR** — mudança incompatível na superfície pública do kit (remoção, troca de assinatura, renomeação, mudança de comportamento observável). Exige uma nova release npm (`x+1.0.0`).
- **MINOR** — adição de superfície pública compatível (novo símbolo, nova porta, novo campo opcional).
- **PATCH** — correção de bug ou ajuste interno que não altera contrato.

A versão do pacote npm `cullet` (em `package.json`) segue seu próprio ciclo, normalmente liberando releases que agregam mudanças em vários kits.

## 2. Imutabilidade de versões publicadas

> Versões antigas **nunca** são removidas do catálogo.

Quando uma versão é publicada, ela vira contrato. Consumidores podem instalar `@cullet/<nome>@<x.y.z>` e esperar o mesmo tarball para sempre. A imutabilidade deixa de ser garantida por um diretório versionado no repo e passa a ser garantida por três artefatos combinados:

1. o tarball publicado no npm,
2. a tag git que corresponde à release,
3. a política operacional de nunca reescrever uma versão após publicação, mesmo durante a janela em que o npm ainda permitiria `unpublish`.

O fluxo de evolução é, então, **estritamente aditivo**:

1. Evolua `packages/<nome>/` na branch corrente.
2. Atualize `packages/<nome>/package.json` e `packages/<nome>/meta.json` para a nova versão.
3. Atualize `registry/index.json`:

- acrescente `<nova-versao>` em `versions`,
- aponte `latest` para ela (se for a nova referência).

4. Publique a nova versão npm e marque a tag git correspondente.

`latest` deixa de ser um diretório local e passa a ser a dist-tag npm do kit. Se uma versão precisou sair com bug crítico, a solução é publicar um PATCH novo (`x.y.z+1`), não reescrever o passado.

## 3. Descontinuação (deprecation)

Uma versão pode ser marcada como **deprecated** quando há um sucessor preferido. A versão **continua disponível** — apenas sinaliza que novos consumidores devem migrar.

Em `meta.json`:

```json
{
  "deprecated": {
    "since": "1.2.0",
    "reason": "API de policies foi reescrita; v1 não suporta condições com escopo de tenant.",
    "successor": {
      "name": "erp-core",
      "version": "2.0.0",
      "guide": "MIGRATION.md",
      "notes": "Atualize os aliases antes de trocar os imports pinados.",
      "codemod": {
        "path": "codemods/1.0.0-to-2.0.0.mjs",
        "description": "Renomeia os simbolos legados da API de policies"
      }
    }
  }
}
```

Campos:

- **`since`** (obrigatório, SemVer) — versão do kit a partir da qual a deprecation foi anunciada (geralmente coincide com a release do sucessor).
- **`reason`** (obrigatório, string não vazia) — por que esta versão foi deprecated. Curta e útil.
- **`successor`** (opcional) — string legada `nome/versao` ou objeto com `name`, `version`, `guide`, `notes` e `codemod`. Usuários do CLI veem essa referência e o `cullet migrate` usa o bloco estruturado.

Para deixar uma versão ativa, use `"deprecated": false` (default do template).

### Como o CLI exibe deprecation

- `cullet list` marca o kit com `[deprecated]` quando a versão `latest` está deprecated, e imprime a razão e o sucessor.
- `cullet info <nome>@<versao>` e `cullet fc <nome>@<versao>` exibem warning amarelo antes de qualquer instrução.
- `cullet migrate <nome>@<versao>` lê o `successor` estruturado, mostra o guia/codemod e pode executar o codemod em `--dry-run` ou `--apply`.

A motivação é dupla: usuários veem o aviso no fluxo natural, e o catálogo nunca quebra silenciosamente.

## 4. Como criar uma versão nova

### Primeira versão de um kit novo

Na topologia de workspace, um kit nasce em `packages/<nome>/` com `package.json`, `tsdown.config.ts`, `src/`, `meta.json`, `README.md` e `KIT_CONTEXT.md`. O scaffold automático ainda está sendo alinhado à nova estrutura; até a conclusão dessa migração, use `templates/kit/` como base e registre o kit manualmente em `registry/index.json`.

### Nova MAJOR de um kit existente

Não há atalho de CLI para isso — é uma decisão de catálogo. Faça manualmente:

1. Evolua `packages/<nome>/src/` na branch da nova release.
2. Atualize `package.json` e `meta.json` do kit (`version`, `changelog`).
3. Faça as mudanças incompatíveis na nova release, sem tentar preservar a árvore anterior no repo.
4. Em `registry/index.json`, adicione a nova versão em `versions` e atualize `latest`.
5. Marque a versão antiga como `deprecated` se a sucessão for clara.
6. Rode o build do pacote e publique a nova versão npm.

## 5. Validação contínua

Durante a transição para o monorepo por pacote, `npm run validate-kits` ainda está sendo adaptado para deixar de varrer `kits/*/versions/*/` e passar a validar `packages/*/meta.json`. A regra de catálogo, porém, já é a mesma:

- Conformidade com `kits/kit-spec.schema.json` (inclui o formato de `deprecated`).
- Existência de `README.md`, `KIT_CONTEXT.md` e `entryPoint`.
- Regras de lint declaradas no kit (`noExternalImports`, `noUpwardImports`, etc.).

CI deve rodar este comando em todo PR. Erros bloqueiam merge; warnings ficam visíveis no log.

## 6. Migração planejada para pacotes por kit

O catálogo está em migração para o modelo (c) descrito em `tmp/plano-migracao-c-cli-registry-29.05.2026.md`: `cullet` permanece como CLI + registry, e cada kit passa a existir como pacote npm próprio no escopo `@cullet/*`.

Nesta fase, os kits já vivem em `packages/<nome>/` e a versão publicada passa a ser a do `package.json` do pacote. A migração restante cobre o scaffold, a validação e a resolução do CLI; enquanto isso, o princípio de imutabilidade já deve ser tratado como regra operacional de release, não mais como uma garantia estrutural de diretórios `versions/` no repo.
