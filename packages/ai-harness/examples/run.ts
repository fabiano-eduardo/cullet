/**
 * End-to-end example: drive an AI agent through a list of tasks.
 *
 * Run it from the repo root (after building the kit so the package resolves):
 *
 *   npm run build -w @cullet/ai-harness
 *   AI_PROVIDER=anthropic \
 *   AI_MODEL=claude-opus-4-8 \
 *   AI_API_KEY=sk-... \
 *   npx tsx packages/ai-harness/examples/run.ts
 *
 * Swap the provider/model/key for any supported vendor:
 *   - anthropic  → AI_MODEL=claude-opus-4-8
 *   - openai     → AI_MODEL=gpt-4o
 *   - openrouter → AI_MODEL=anthropic/claude-opus-4-8
 *   - google     → AI_MODEL=gemini-2.0-flash
 *
 * Set GIT_CHECKPOINT=1 to commit each passing task and roll back failures —
 * run that on a clean, dedicated branch (it uses `git reset --hard`).
 */
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import {
    createProviderResolver,
    runHarness,
    type ProviderName,
    type SkillRegistry,
    type Task,
} from "@cullet/ai-harness";
import {
    createGitCheckpoint,
    fileBlockPrompt,
    nodeFileWriter,
    shellVerifier,
} from "@cullet/ai-harness/node";

const here = dirname(fileURLToPath(import.meta.url));

function env(name: string, fallback?: string): string {
    const value = process.env[name] ?? fallback;
    if (value === undefined) {
        throw new Error(`Missing required env var: ${name}`);
    }
    return value;
}

async function main(): Promise<void> {
    // 1. Provider selection — per task. Each task in tasks.json names its own
    //    `provider`/`model`; createProviderResolver maps those to a concrete
    //    provider using the API keys you pass here, explicitly. Tasks without a
    //    provider/model fall back to defaultProvider/defaultModel.
    const resolveProvider = createProviderResolver({
        anthropic: { apiKey: env("ANTHROPIC_API_KEY", env("AI_API_KEY", "")) },
        openai: { apiKey: env("OPENAI_API_KEY", "") },
        defaultProvider: env("AI_PROVIDER", "anthropic") as ProviderName,
        defaultModel: env("AI_MODEL", "claude-opus-4-8"),
    });

    // 2. Skills — reusable, named instruction blocks. A task references them by
    //    name (tasks.json: "skills": ["clean-code"]) and the default prompt
    //    injects them under a `# Skills` section.
    const skills: SkillRegistry = {
        "clean-code": [
            "Prefer small, single-responsibility functions.",
            "No dead code or commented-out blocks.",
            "Name things for intent, not implementation.",
        ].join("\n"),
    };

    // 3. The tasks — plain data. Here we load the sample TDD-style list, but they
    //    can come from anywhere (a file, a queue, an issue tracker).
    const tasks = JSON.parse(
        await readFile(resolve(here, "tasks.json"), "utf-8"),
    ) as Task[];

    // 4. The project the agent works in. Point this at a real project root.
    const projectRoot = env("PROJECT_ROOT", process.cwd());

    // 5. Optional extended thinking budget (e.g. AI_THINKING_BUDGET=10000).
    const thinkingBudget = process.env.AI_THINKING_BUDGET
        ? Number(process.env.AI_THINKING_BUDGET)
        : undefined;

    // 6. Strategies: write FILE: blocks to disk, and verify with your own commands.
    const apply = nodeFileWriter({
        projectRoot,
        onWrite: ({ path, written, reason }) =>
            console.log(
                `    ${written ? "wrote" : `skipped (${reason})`}: ${path}`,
            ),
    });

    const verify = shellVerifier(["npm run typecheck", "npm test"], {
        cwd: projectRoot,
    });

    const useGit = process.env.GIT_CHECKPOINT === "1";
    const checkpoint = createGitCheckpoint({
        cwd: projectRoot,
        onCheckpoint: ({ taskId, action }) =>
            console.log(`    git: ${action} (${taskId})`),
    });

    // 7. Run. Mutates `tasks` in place, so you could persist progress between runs.
    const summary = await runHarness({
        resolveProvider,
        skills,
        tasks,
        apply,
        buildPrompt: thinkingBudget
            ? async (args) => {
                  const req = await fileBlockPrompt(args);
                  return { ...req, thinking: { budgetTokens: thinkingBudget } };
              }
            : fileBlockPrompt,
        verify: useGit ? checkpoint.wrapVerify(verify) : verify,
        limits: { maxAttempts: 3, maxCostUSD: 5, pauseBetweenTasksMs: 1_000 },
        // Token pricing varies per model — plug your own table in here.
        estimateCost: (usage) =>
            (usage.inputTokens * 3 + usage.outputTokens * 15) / 1_000_000,
        onEvent: (event) => {
            switch (event.type) {
                case "task-start":
                    console.log(
                        `\n▶ ${event.task.id} (attempt ${event.attempt})`,
                    );
                    break;
                case "model-result":
                    console.log(
                        `  🤖 ${event.provider.id}/${event.provider.model}`,
                    );
                    if (event.result.reasoning) {
                        console.log(
                            `  💭 ${event.result.reasoning.slice(0, 200)}`,
                        );
                    }
                    break;
                case "task-done":
                    console.log(`  ✅ ${event.task.id}`);
                    break;
                case "task-retry":
                    console.log(
                        `  ↻ ${event.task.id}: ${event.feedback?.slice(0, 80)}`,
                    );
                    break;
                case "task-failed":
                    console.log(`  ❌ ${event.task.id}`);
                    break;
                case "stop":
                    console.log(`\n■ stopped: ${event.reason}`);
                    break;
                default:
                    break;
            }
        },
    });

    console.log("\nSummary:", summary);
}

main().catch((err) => {
    console.error("Fatal:", err);
    process.exitCode = 1;
});
