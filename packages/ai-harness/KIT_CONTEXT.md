# ai-harness — KIT_CONTEXT

## [purpose] Propósito

Conectar um projeto a um agente de IA via chave de API, receber tarefas e deixar o agente resolvê-las — com retry guiado por feedback e limites de tentativas/custo/prazo.

## [layers] Estrutura do `src/`

- **`providers/`** — adapters neutros por fornecedor (Anthropic, OpenAI, OpenRouter, Google), todos sobre `fetch`. `createProvider` é a porta de entrada. Sem SDK.
- **`harness/`** — núcleo neutro: `Task`, helpers de tarefa e o loop `runHarness`. Não conhece arquivos, testes nem toolchain.
- **`runtime/node.ts`** — helpers opt-in no subpath `@cullet/ai-harness/node`: escrita de blocos `FILE:`, `fileBlockPrompt` e sensores via shell.

## [key-decisions] Decisões-chave

- **Neutralidade de fornecedor.** O harness só fala com `AgentProvider.complete`; adapters via `fetch`, sem SDK.
- **Neutralidade de arquitetura.** `apply` e `verify` são injetados; nada de TDD ou toolchain presumido.
- **Chave por parâmetro.** O kit nunca lê do ambiente.
- **Sem `model` default.** Obrigatório para não apodrecer.
- **Side-effects isolados** atrás do subpath `./node`.
- **Extended thinking.** `CompletionRequest.thinking?: { budgetTokens }` pede reasoning; `CompletionResult.reasoning` devolve o pensamento separado de `text`. Só Anthropic implementa; demais providers aceitam sem quebrar (no-op).
- **Provider/modelo por task.** `Task.provider`/`Task.model` selecionam o fornecedor por tarefa. O core não vira string em provider (não lê chave); a ponte é `config.resolveProvider(task)`, com `createProviderResolver({...})` pronto (chaves explícitas, memoizado). `config.provider` segue como fallback.
- **Skills.** `Task.skills: string[]` referencia `config.skills` (registry nome→texto/`Skill`); o harness resolve e injeta a seção `# Skills` no prompt default. Nome desconhecido falha rápido.

## [extension-points] Pontos de extensão

- `buildPrompt`, `apply`, `verify` — injetáveis pelo consumidor.
- `resolveProvider` — escolhe provider/modelo por task (`createProviderResolver`).
- `skills` — registry de instruções nomeadas referenciadas por `Task.skills`.
- `estimateCost` — converte tokens em USD para o teto.
- `fetchImpl` / `baseURL` / `headers` — gateways, proxies e testes.

## [non-goals] Não-objetivos

- Não dita arquitetura, camadas nem estilo de teste.
- Não embute SDK de fornecedor nem chaves.
- Não fixa modelos nem preços.
