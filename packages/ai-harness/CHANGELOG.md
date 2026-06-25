# @cullet/ai-harness

## 1.4.0

### Minor Changes

- 1c5ebc7: Add per-task provider/model selection and named skills.
    - **Per-task provider & model**: tasks can now declare their own `provider` and `model`. `runHarness` accepts a `resolveProvider(task)` hook (with `provider` kept as a fallback), and the new `createProviderResolver({ anthropic: { apiKey }, ... })` helper maps each task's `provider`/`model` to a memoized `AgentProvider` using keys you pass explicitly. The resolved provider also flows into `estimateCost` and the `model-result` event (`event.provider`).
    - **Skills**: a task can list `skills` by name, resolved against a `config.skills` registry (`Record<string, string | Skill>`). The default prompt renders them under a `# Skills` section (inherited by `fileBlockPrompt`); custom builders receive them via `BuildPromptArgs.skills`. Unknown skill names fail fast. Exposes `resolveSkills` plus the `Skill`, `SkillRegistry`, and `ProviderResolver` types.

    Both additions are backward compatible.

## 1.3.0

### Minor Changes

- 7aee0a3: Add extended thinking (reasoning) support to the provider contract and Anthropic adapter

## 1.2.0

### Minor Changes

- 73b72f4: Close the prompt↔writer gap in the Node runtime.
    - Add `fileBlockPrompt` (exported from `@cullet/ai-harness/node`): a `buildPrompt` that wraps the neutral `defaultBuildPrompt` with the `FILE:` output contract that `nodeFileWriter` consumes. The architecture-neutral core stays free of any output-format assumption.
    - `nodeFileWriter` now signals a no-op via `onWrite` (`reason: "no FILE: blocks in output"`) when the model returns non-empty text containing no `FILE:` blocks, instead of silently writing nothing and letting the task pass for free. Empty or whitespace-only output stays silent.
    - Update `examples/run.ts`, the README, and `KIT_CONTEXT.md` to pair `fileBlockPrompt` with `nodeFileWriter` and document the coupling.

## 1.1.0

### Minor Changes

- 615775b: Add @cullet/ai-harness: a provider-neutral AI agent harness. Ships fetch-based adapters for Anthropic, OpenAI, OpenRouter and Google (no vendor SDK dependency), an importable `runHarness` loop with injectable `apply`/`verify`/`buildPrompt` strategies, and opt-in Node runtime helpers (file writing with guardrails, shell sensors, and a git checkpoint that commits passing tasks and rolls back failed attempts) under the `@cullet/ai-harness/node` subpath. The API key is always passed explicitly and no model id is hard-coded.

    Guardrails included from the start: `runHarness` fails fast when `limits.maxCostUSD` is set without an `estimateCost` (an inert cap that would never trip); `createGitCheckpoint` refuses to start in a dirty working tree unless `requireCleanStart: false`, so a rollback can't reset over pre-existing work; and `nodeFileWriter` adds a deny-by-default `allowedPatterns` allowlist and a `dryRun` preview. Opt-in live smoke tests (`AI_HARNESS_LIVE=1 npm run test:live`) validate each provider's real wire format before a release without running in CI.
