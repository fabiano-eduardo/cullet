---
"@cullet/ai-harness": minor
---

Close the prompt↔writer gap in the Node runtime.

- Add `fileBlockPrompt` (exported from `@cullet/ai-harness/node`): a `buildPrompt` that wraps the neutral `defaultBuildPrompt` with the `FILE:` output contract that `nodeFileWriter` consumes. The architecture-neutral core stays free of any output-format assumption.
- `nodeFileWriter` now signals a no-op via `onWrite` (`reason: "no FILE: blocks in output"`) when the model returns non-empty text containing no `FILE:` blocks, instead of silently writing nothing and letting the task pass for free. Empty or whitespace-only output stays silent.
- Update `examples/run.ts`, the README, and `KIT_CONTEXT.md` to pair `fileBlockPrompt` with `nodeFileWriter` and document the coupling.
