# ai-harness — KIT_CONTEXT

## [purpose] Propósito

Conectar um projeto a um agente de IA via chave de API, receber uma lista de tarefas e deixar o agente resolvê-las — com retry guiado por feedback e limites de tentativas/custo/prazo. É importável (caminho principal) e também copiável via `npx cullet fc`.

## [layers] Estrutura do `src/`

`cullet` não impõe arquitetura; o kit se organiza em três fronteiras simples:

- **`providers/`** — adapters neutros por fornecedor (Anthropic, OpenAI, OpenRouter, Google), todos sobre `fetch`. `createProvider({ provider, apiKey, model })` é a única porta de entrada. Nenhum SDK de fornecedor é dependência.
- **`harness/`** — o núcleo neutro: `Task`, helpers puros de tarefa e o loop `runHarness`. Não conhece arquivos, testes nem toolchain.
- **`runtime/node.ts`** — helpers opt-in para Node, no subpath `@cullet/ai-harness/node`: escrita de blocos `FILE:` com guardrails e sensores via shell. Side-effects de ambiente isolados aqui.

## [key-decisions] Decisões-chave

- **Neutralidade de fornecedor.** O harness só fala com `AgentProvider.complete`; trocar de Anthropic para OpenRouter é trocar uma linha. Adapters via `fetch`, sem SDK.
- **Neutralidade de arquitetura.** O que fazer com a saída (`apply`) e como verificar sucesso (`verify`) são **injetados** pelo consumidor. Nada de TDD, `targetFiles` ou `eslint/tsc/vitest` presumidos no núcleo.
- **Chave por parâmetro.** A API key entra em `createProvider`; o kit nunca lê do ambiente por você.
- **Sem `model` default.** `model` é obrigatório para o id de modelo não apodrecer no pacote.
- **Side-effects de ambiente isolados** atrás do subpath `./node`, mantendo o import raiz neutro.

## [extension-points] Pontos de extensão

- `buildPrompt({ task, tasks })` — molda o prompt (regras do projeto, system prompt, formato de saída).
- `apply({ task, result })` — o que fazer com a saída do modelo (escrever arquivos, abrir PR, chamar tooling próprio).
- `verify({ task })` — decide se a tentativa passou; o feedback volta no próximo prompt.
- `estimateCost(usage, provider)` — converte tokens em USD para o teto de custo.
- `fetchImpl` / `baseURL` / `headers` — gateways, proxies e testes.

## [non-goals] Não-objetivos

- **Não é framework de arquitetura.** Não dita camadas, pastas nem estilo de teste.
- **Não embute SDK de fornecedor** nem chaves; não lê env por você.
- **Não fixa modelos nem preços.** Modelo é input; custo é injetável.
- **Não é runner acoplado a TDD.** Verificar por testes é helper opt-in do `./node`.
