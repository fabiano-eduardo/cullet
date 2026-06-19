---
"@cullet/ai-harness": minor
---

Add per-task provider/model selection and named skills.

- **Per-task provider & model**: tasks can now declare their own `provider` and `model`. `runHarness` accepts a `resolveProvider(task)` hook (with `provider` kept as a fallback), and the new `createProviderResolver({ anthropic: { apiKey }, ... })` helper maps each task's `provider`/`model` to a memoized `AgentProvider` using keys you pass explicitly. The resolved provider also flows into `estimateCost` and the `model-result` event (`event.provider`).
- **Skills**: a task can list `skills` by name, resolved against a `config.skills` registry (`Record<string, string | Skill>`). The default prompt renders them under a `# Skills` section (inherited by `fileBlockPrompt`); custom builders receive them via `BuildPromptArgs.skills`. Unknown skill names fail fast. Exposes `resolveSkills` plus the `Skill`, `SkillRegistry`, and `ProviderResolver` types.

Both additions are backward compatible.
