# @cullet/ai-harness

## 1.1.0

### Minor Changes

- 615775b: Add @cullet/ai-harness: a provider-neutral AI agent harness. Ships fetch-based adapters for Anthropic, OpenAI, OpenRouter and Google (no vendor SDK dependency), an importable `runHarness` loop with injectable `apply`/`verify`/`buildPrompt` strategies, and opt-in Node runtime helpers (file writing with guardrails, shell sensors, and a git checkpoint that commits passing tasks and rolls back failed attempts) under the `@cullet/ai-harness/node` subpath. The API key is always passed explicitly and no model id is hard-coded.

    Guardrails included from the start: `runHarness` fails fast when `limits.maxCostUSD` is set without an `estimateCost` (an inert cap that would never trip); `createGitCheckpoint` refuses to start in a dirty working tree unless `requireCleanStart: false`, so a rollback can't reset over pre-existing work; and `nodeFileWriter` adds a deny-by-default `allowedPatterns` allowlist and a `dryRun` preview. Opt-in live smoke tests (`AI_HARNESS_LIVE=1 npm run test:live`) validate each provider's real wire format before a release without running in CI.
