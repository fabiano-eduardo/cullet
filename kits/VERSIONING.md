# Versionamento e descontinuação de kits

Este documento fixa as regras que todo kit do catálogo `cullet` segue para evoluir sem quebrar consumidores existentes. As regras são curtas, opinativas e auditáveis pelo `npm run validate-kits`.

## 1. SemVer aplicado ao kit, não ao pacote

Cada kit tem **sua própria versão SemVer**, independente da versão do pacote npm `cullet`. A versão vive em `kits/<nome>/versions/<x.y.z>/meta.json` (campo `version`) e em `registry/index.json` (`versions` e `latest`).

- **MAJOR** — mudança incompatível na superfície pública do kit (remoção, troca de assinatura, renomeação, mudança de comportamento observável). Exige nova pasta `versions/<x+1.0.0>/`.
- **MINOR** — adição de superfície pública compatível (novo símbolo, nova porta, novo campo opcional).
- **PATCH** — correção de bug ou ajuste interno que não altera contrato.

A versão do pacote npm `cullet` (em `package.json`) segue seu próprio ciclo, normalmente liberando releases que agregam mudanças em vários kits.

## 2. Imutabilidade de versões publicadas

> Versões antigas **nunca** são removidas do catálogo.

Quando uma versão é publicada, ela vira contrato. Consumidores podem importar `cullet/<nome>/<x.y.z>` e esperar a mesma superfície para sempre. O fluxo de evolução é, então, **estritamente aditivo**:

1. Crie uma nova pasta `kits/<nome>/versions/<nova-versao>/`.
2. Atualize `registry/index.json`:
   - acrescente `<nova-versao>` em `versions`,
   - aponte `latest` para ela (se for a nova referência).
3. **Não** edite arquivos dentro de pastas de versões antigas, exceto:
   - correções de typo em `README.md` ou `KIT_CONTEXT.md`,
   - marcação de `deprecated` em `meta.json` (ver seção 3).

Se uma versão precisou ser publicada com bug crítico, a solução é publicar um PATCH novo (`x.y.z+1`), não reescrever o passado.

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

```bash
npm run new-kit -- <nome-do-kit>
# opcional:
npm run new-kit -- <nome-do-kit> --description "Descrição curta do kit"
```

O script (`scripts/new-kit.mjs`) copia `templates/kit/` para `kits/<nome>/versions/1.0.0/`, faz a substituição de placeholders, e adiciona a entrada no `registry/index.json`. Os próximos passos (validar, implementar, buildar) são impressos no final da execução.

### Nova MAJOR de um kit existente

Não há atalho de CLI para isso — é uma decisão de catálogo. Faça manualmente:

1. Copie a pasta `kits/<nome>/versions/<antiga>/` para `kits/<nome>/versions/<nova>/`.
2. Atualize `meta.json` da nova versão (`version`, `changelog`).
3. Faça as mudanças incompatíveis somente dentro da nova pasta.
4. Em `registry/index.json`, adicione a nova versão em `versions` e atualize `latest`.
5. Marque a versão antiga como `deprecated` se a sucessão for clara.
6. Rode `npm run validate-kits` e `npm run build`.

## 5. Validação contínua

`npm run validate-kits` percorre todas as pastas `kits/*/versions/*/` que têm `meta.json` e checa:

- Conformidade com `kits/kit-spec.schema.json` (inclui o formato de `deprecated`).
- Existência de `README.md`, `KIT_CONTEXT.md` e `entryPoint`.
- Regras de lint declaradas no kit (`noExternalImports`, `noUpwardImports`, etc.).

CI deve rodar este comando em todo PR. Erros bloqueiam merge; warnings ficam visíveis no log.
