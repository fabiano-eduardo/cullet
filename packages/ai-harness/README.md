# @cullet/ai-harness

**Provider-neutral AI agent harness.** Bring an API key, define a list of tasks, and let an AI agent work through them — retrying with feedback until each task is done or its limits are hit.

For the prompt-friendly summary see [`KIT_CONTEXT.md`](./KIT_CONTEXT.md). For the contracts common to every kit see the repository [`PHILOSOPHY.md`](../../PHILOSOPHY.md).

---

## What it delivers

- **Provider adapters** (`createProvider`) for **Anthropic**, **OpenAI**, **OpenRouter** and **Google Gemini** — all over `fetch`, no vendor SDK dependency. The API key is always passed explicitly.
- **`runHarness`** — an importable orchestration loop that selects the next runnable task, prompts the model, applies the result, optionally verifies it, and retries with feedback.
- **Per-task provider & model.** A task can name its own `provider` + `model`; `createProviderResolver` maps those to a concrete provider (with your keys, memoized). A single `provider` still works as a default/fallback.
- **Skills** — named, reusable instruction blocks. A task lists `skills` by name; the harness resolves them against a registry and the default prompt injects them under a `# Skills` section.
- **Architecture-neutral by design.** The harness makes no assumption about TDD, file layout, or toolchain. You inject `apply` (what to do with the output) and, optionally, `verify` (how to check success) and `buildPrompt`.
- **Opt-in Node helpers** under `@cullet/ai-harness/node`: write `FILE:` blocks to disk with guardrails, prompt for that format with `fileBlockPrompt`, and run shell commands (lint/typecheck/tests/build — your call) as verification sensors.

## Quick start

```ts
import { createProvider, runHarness, type Task } from "@cullet/ai-harness";
import {
    fileBlockPrompt,
    nodeFileWriter,
    shellVerifier,
} from "@cullet/ai-harness/node";

const provider = createProvider({
    provider: "openrouter", // or "anthropic" | "openai" | "google"
    apiKey: process.env.OPENROUTER_API_KEY!,
    model: "anthropic/claude-opus-4-8",
});

const tasks: Task[] = [
    {
        id: "task-1",
        description: "Implement the add(a, b) function in src/math.ts.",
    },
];

const summary = await runHarness({
    provider,
    tasks,
    // `fileBlockPrompt` asks the model for the `FILE:` format that
    // `nodeFileWriter` applies — pair them, or the writer writes nothing.
    buildPrompt: fileBlockPrompt,
    apply: nodeFileWriter({ projectRoot: process.cwd() }),
    verify: shellVerifier(["npm run typecheck", "npm test"]),
    limits: { maxAttempts: 3, maxCostUSD: 5 },
    onEvent: (e) => console.log(e.type),
});

console.log(summary); // { done, failed, pending, totalCostUSD, stoppedBy }
```

### Output contract: `FILE:` blocks (prompt ↔ writer)

`nodeFileWriter` only applies output shaped as `FILE:` fenced blocks:

````text
FILE: src/math.ts
```ts
export const add = (a: number, b: number) => a + b;
```
````

The architecture-neutral `defaultBuildPrompt` deliberately says nothing about
this format, so the two halves must be paired explicitly. Use **`fileBlockPrompt`**
(from `@cullet/ai-harness/node`) as your `buildPrompt`: it wraps the default
prompt with the `FILE:` contract that the writer consumes. Pairing one without
the other is the classic footgun — if the model never emits `FILE:` blocks, the
writer has nothing to apply. To make that failure observable rather than silent,
`nodeFileWriter` reports a no-op via `onWrite` (`reason: "no FILE: blocks in
output"`) whenever the model returns non-empty text with no blocks. Supplying
your own `buildPrompt` is fine too — just keep emitting `FILE:` blocks, or swap
in an `apply` that matches your own format.

Full-control mode (copy the source into your project) is also available:

```bash
npx cullet fc ai-harness@1.0.0
```

## Picking a provider

| `provider`   | SDK          | Default base URL                           | Auth                    |
| ------------ | ------------ | ------------------------------------------ | ----------------------- |
| `anthropic`  | none (fetch) | `api.anthropic.com/v1`                     | `x-api-key`             |
| `openai`     | none (fetch) | `api.openai.com/v1`                        | `Authorization: Bearer` |
| `openrouter` | none (fetch) | `openrouter.ai/api/v1`                     | `Authorization: Bearer` |
| `google`     | none (fetch) | `generativelanguage.googleapis.com/v1beta` | `?key=`                 |

`model` is always required — the kit ships no hard-coded model id so it cannot rot. Override `baseURL`, `headers` or `fetchImpl` for gateways, proxies, or tests.

## Per-task provider & model

Each task can declare which vendor and model it runs on, instead of one global provider. The core stays provider-neutral and **never reads API keys** — so the string→provider bridge is a `resolveProvider` hook you supply. `createProviderResolver` is the batteries-included one: you hand it the keys once, it reads each task's `provider`/`model` and returns a memoized `AgentProvider`.

```ts
import {
    createProviderResolver,
    runHarness,
    type Task,
} from "@cullet/ai-harness";

const resolveProvider = createProviderResolver({
    anthropic: {
        apiKey: process.env.ANTHROPIC_API_KEY!,
        defaultModel: "claude-opus-4-8",
    },
    openai: { apiKey: process.env.OPENAI_API_KEY! },
    defaultProvider: "anthropic", // for tasks that name no provider
});

const tasks: Task[] = [
    {
        id: "a",
        description: "…",
        provider: "anthropic",
        model: "claude-opus-4-8",
    },
    { id: "b", description: "…", provider: "openai", model: "gpt-4o" },
    { id: "c", description: "…" }, // uses defaultProvider + defaultModel
];

await runHarness({
    resolveProvider,
    // `provider` is still accepted as a plain fallback when you don't need a resolver.
    tasks,
    apply: /* … */ () => {},
});
```

Resolution precedence: vendor is `task.provider` → `defaultProvider`; model is `task.model` → `<vendor>.defaultModel` → `defaultModel`. Providers are cached by `provider|model|baseURL`. A task with no resolvable provider (no resolver and no default) fails with a clear error. The resolved provider also flows into `estimateCost(usage, provider)` and the `model-result` event (`event.provider`), so per-model pricing and logging just work.

## Skills

Skills are named, reusable instruction blocks. Register them on `skills` and reference them by name from each task; the default prompt renders the resolved skills under a `# Skills` section (and `fileBlockPrompt` inherits it).

```ts
await runHarness({
    provider,
    skills: {
        tdd: "Write a failing test before the implementation.",
        "sql-safe": {
            name: "SQL safety",
            instructions:
                "Never build SQL by string concatenation; use parameters.",
        },
    },
    tasks: [
        {
            id: "a",
            description: "Implement the repository.",
            skills: ["tdd", "sql-safe"],
        },
    ],
    apply: /* … */ () => {},
});
```

A registry value can be a plain string (its key becomes the skill name) or a `Skill` object (`{ name?, instructions, description? }`). Referencing an unknown skill name fails fast, naming the missing skill. A custom `buildPrompt` receives the already-resolved skills via `args.skills` and can render them however it likes.

## Extended thinking (reasoning)

Request reasoning/extended thinking by setting `thinking.budgetTokens` on `CompletionRequest`. The model's reasoning is returned separately in `CompletionResult.reasoning` — `text` stays the final answer only.

```ts
const request: CompletionRequest = {
    messages: [{ role: "user", content: "Solve step by step" }],
    maxTokens: 16_000,
    thinking: { budgetTokens: 10_000 },
};

const result = await provider.complete(request);
console.log(result.reasoning); // model's chain of thought
console.log(result.text); // final answer
```

**Provider support:** only Anthropic implements thinking today. OpenAI, OpenRouter and Google accept the option without error but ignore it (`reasoning` is always `undefined`). When thinking is enabled on Anthropic, `temperature` is omitted (API constraint) and `maxTokens` must exceed `budgetTokens`.

In the example script, set `AI_THINKING_BUDGET=10000` to enable thinking.

## Extending it

- **Custom prompts**: pass `buildPrompt({ task, tasks })` to inject project rules, a system prompt, or output conventions. With `nodeFileWriter`, use `fileBlockPrompt` (or keep the `FILE:` contract in your own builder) so the model emits blocks the writer can apply.
- **Custom apply/verify**: any function works — write files, open PRs, call your own tooling. The bundled `nodeFileWriter`/`shellVerifier` are just one convenient default.
- **File-writer guardrails**: `nodeFileWriter` confines writes to `projectRoot` and refuses `protectedPatterns` (a denylist) out of the box. Tighten the blast radius further with `allowedPatterns` (deny-by-default — only matching paths are written, e.g. `[/^src\//]`), and preview a run with `dryRun: true` (reports each intended write via `onWrite` without touching disk).
- **Cost cap**: pass `estimateCost(usage, provider)` to translate token usage into USD and stop at `limits.maxCostUSD`. Setting `maxCostUSD` **without** `estimateCost` throws at entry — an unestimated cap prices every call at 0 and would never trip, so the harness refuses to run unbounded.
- **Cancellation**: pass an `AbortSignal` via `signal`.

## Git checkpointing (opt-in)

`createGitCheckpoint` (from the `./node` subpath) commits each passing task and rolls back failed attempts, so a run produces clean, bisectable history and a failed attempt never leaks into the next one. Wire it through `verify`:

```ts
import {
    createGitCheckpoint,
    nodeFileWriter,
    shellVerifier,
} from "@cullet/ai-harness/node";

const checkpoint = createGitCheckpoint({ cwd: projectRoot });

await runHarness({
    provider,
    tasks,
    apply: nodeFileWriter({ projectRoot }),
    verify: checkpoint.wrapVerify(
        shellVerifier(["npm run typecheck", "npm test"]),
    ),
});
```

> Run this on a clean, dedicated branch: rollback is `git reset --hard` + `git clean -fd`, which discards **all** uncommitted changes in `cwd`. As a safety net, `createGitCheckpoint` refuses to start if the tree is already dirty (it would otherwise reset over your work); pass `requireCleanStart: false` to opt into running dirty on purpose.

## Live smoke tests (opt-in)

The unit suite stubs `fetch`, so it never exercises a provider's real wire format. [`src/providers/live.spec.ts`](./src/providers/live.spec.ts) closes that gap with a smoke test per provider — but it is **skipped** unless `AI_HARNESS_LIVE=1` and that provider's key + model env vars are set, so CI never runs it and never spends a token. Run it by hand before a release, against each provider you actually ship:

```bash
AI_HARNESS_LIVE=1 \
  ANTHROPIC_API_KEY=sk-... ANTHROPIC_MODEL=claude-opus-4-8 \
  npm run test:live
```

Set the matching `<PROVIDER>_API_KEY` + `<PROVIDER>_MODEL` pair (`ANTHROPIC`, `OPENAI`, `OPENROUTER`, `GOOGLE`) for each provider you want covered; any pair you omit is skipped.

## Examples

A complete, runnable script lives in [`examples/run.ts`](./examples/run.ts) (loads [`examples/tasks.json`](./examples/tasks.json)):

```bash
npm run build -w @cullet/ai-harness
AI_PROVIDER=anthropic AI_MODEL=claude-opus-4-8 AI_API_KEY=sk-... \
  npx tsx packages/ai-harness/examples/run.ts
```
