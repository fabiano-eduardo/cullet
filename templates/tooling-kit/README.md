# **KIT_NAME**

**KIT_DESCRIPTION**

Kit do tipo **tooling**: é adicionado ao projeto por cópia, não por import. Para o sumário prompt-friendly veja [`KIT_CONTEXT.md`](./KIT_CONTEXT.md).

---

## O que entrega

Substitua esta seção pela descrição concreta do payload:

- o que vive em `files/` (arquivos, configs, hooks, scripts) e o que cada parte resolve
- para onde os arquivos vão no projeto consumidor (placement declarado em `meta.json`)
- limites: o que está pronto, o que é só esqueleto

## Como adicionar a um projeto

```bash
npx cullet fc __KIT_NAME__@1.0.0
```

O comando copia o conteúdo de `files/` para o placement declarado (por padrão `.claude/`), mesclando com o que já existir ali. Não há `import` nem alias de `tsconfig.json`: os arquivos passam a fazer parte do projeto.

Use `--dry-run` para ver exatamente o que seria copiado e quais arquivos existentes seriam sobrescritos.

## Decisões tomadas

- **Placement**: `.claude/` (ajuste em `meta.json` → `delivery.copy.placement`).
- **Payload**: tudo dentro de `files/`. Edite ali; a raiz do pacote só carrega metadados.
- Adicione aqui as decisões específicas deste kit.

## Como evoluir

- **Novo conteúdo**: adicione/edite arquivos em `files/`.
- **Dependências externas**: declare em `meta.json` → `delivery.copy.dependencies` para que o consumidor saiba o que instalar.
- **Passo de inicialização**: se o kit precisar rodar algo após a cópia, aponte `delivery.copy.postInstall` para um script `.mjs` dentro do payload.
- **Antes de publicar**: rode `npm run validate-kits` para garantir que o kit ainda é válido.
