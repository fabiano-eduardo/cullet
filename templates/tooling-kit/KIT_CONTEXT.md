# **KIT_NAME** — KIT_CONTEXT

## [purpose] Propósito

**KIT_DESCRIPTION**

Este é um kit do tipo **tooling**: ele não é importado em runtime. Em vez disso,
seus arquivos são copiados para dentro do projeto consumidor (no placement
declarado em `meta.json`, por padrão `.claude/`) e passam a fazer parte dele.
Substitua esta descrição pelo problema-alvo específico antes da primeira release.

## [key-decisions] Decisões-chave

- **Entrega por cópia, não por import.** O kit declara `delivery.copy.placement`;
  o CLI mescla o conteúdo de `files/` nesse diretório, preservando o que já
  existe e sobrescrevendo apenas os arquivos do próprio kit (após confirmação).
- **Sem alias de tsconfig e sem ponto de entrada TypeScript.** Não há nada para
  importar; o payload pode ser qualquer coisa (markdown, configs, hooks, scripts).
- **O payload mora em `files/`.** Tudo dentro de `files/` é o que será copiado;
  edite ali, não na raiz do pacote.

## [non-goals] Não-objetivos

- **Não é uma biblioteca.** Não exporta símbolos nem expõe API de runtime, e por
  isso não aparece como dependência importável no código do consumidor.
- **Não substitui arquivos de configuração existentes em massa.** A cópia é um
  merge: arquivos que o kit não traz são preservados, e cada conflito individual
  com um arquivo já presente exige confirmação explícita antes de sobrescrever.
- **Não gerencia atualização automática.** Reaplicar uma versão mais nova é uma
  nova execução de `fc`, com o mesmo fluxo de confirmação de conflitos.
- Substitua esta lista pelos não-objetivos reais do kit antes da release.
