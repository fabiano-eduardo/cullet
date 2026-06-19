import { describe, expect, it } from "vitest";
import type {
    AgentProvider,
    CompletionRequest,
    CompletionResult,
} from "../providers/types.js";
import { runHarness } from "./run.js";
import type { HarnessEvent, Task } from "./types.js";

// A hand-written fake provider (no module mocks): it echoes a scripted reply per
// task id and records every request it received.
function fakeProvider(replies: Record<string, string>): {
    provider: AgentProvider;
    requests: CompletionRequest[];
} {
    const requests: CompletionRequest[] = [];
    const provider: AgentProvider = {
        id: "anthropic",
        model: "fake-model",
        async complete(request: CompletionRequest): Promise<CompletionResult> {
            requests.push(request);
            const id =
                /ID:\s*(\S+)/.exec(request.messages[0]?.content ?? "")?.[1] ??
                "";
            return {
                text: replies[id] ?? "",
                usage: { inputTokens: 10, outputTokens: 5 },
                raw: {},
            };
        },
    };
    return { provider, requests };
}

describe("runHarness", () => {
    it("resolves tasks in dependency order and reports a complete summary", async () => {
        const tasks: Task[] = [
            { id: "task-2", description: "second", dependsOn: ["task-1"] },
            { id: "task-1", description: "first" },
        ];
        const applied: string[] = [];
        const { provider } = fakeProvider({
            "task-1": "out-1",
            "task-2": "out-2",
        });

        const summary = await runHarness({
            provider,
            tasks,
            apply: ({ task }) => {
                applied.push(task.id);
            },
        });

        expect(applied).toEqual(["task-1", "task-2"]); // dependency order honoured
        expect(summary.done).toBe(2);
        expect(summary.stoppedBy).toBe("complete");
        expect(tasks.every((t) => t.status === "done")).toBe(true);
    });

    it("retries with verifier feedback and gives up after maxAttempts", async () => {
        const tasks: Task[] = [{ id: "t", description: "flaky" }];
        const { provider } = fakeProvider({ t: "code" });
        let calls = 0;

        const summary = await runHarness({
            provider,
            tasks,
            apply: () => {},
            verify: () => {
                calls += 1;
                return { passed: false, feedback: `fail #${calls}` };
            },
            limits: { maxAttempts: 2, pauseBetweenTasksMs: 0 },
        });

        expect(calls).toBe(2);
        expect(summary.failed).toBe(1);
        expect(summary.stoppedBy).toBe("exhausted");
        expect(tasks[0].lastFeedback).toBe("fail #2");
    });

    it("stops when the abort signal is already aborted", async () => {
        const controller = new AbortController();
        controller.abort();
        const { provider, requests } = fakeProvider({});

        const summary = await runHarness({
            provider,
            tasks: [{ id: "t", description: "x" }],
            apply: () => {},
            signal: controller.signal,
        });

        expect(requests).toHaveLength(0);
        expect(summary.stoppedBy).toBe("aborted");
    });

    it("stops with 'cost' once the accumulated cost reaches the cap", async () => {
        const tasks: Task[] = [
            { id: "a", description: "a" },
            { id: "b", description: "b" },
            { id: "c", description: "c" },
        ];
        const applied: string[] = [];
        const { provider } = fakeProvider({ a: "1", b: "2", c: "3" });

        const summary = await runHarness({
            provider,
            tasks,
            apply: ({ task }) => {
                applied.push(task.id);
            },
            estimateCost: () => 0.5,
            limits: { maxCostUSD: 1, pauseBetweenTasksMs: 0 },
        });

        expect(applied).toEqual(["a", "b"]); // third task never starts
        expect(summary.totalCostUSD).toBe(1);
        expect(summary.done).toBe(2);
        expect(summary.pending).toBe(1);
        expect(summary.stoppedBy).toBe("cost");
    });

    it("rejects at entry when maxCostUSD is set without an estimateCost", async () => {
        const { provider, requests } = fakeProvider({ t: "x" });

        await expect(
            runHarness({
                provider,
                tasks: [{ id: "t", description: "x" }],
                apply: () => {},
                limits: { maxCostUSD: 5 },
            }),
        ).rejects.toThrow(/maxCostUSD is set.*no estimateCost/s);

        // It fails before touching the provider — no tokens are spent.
        expect(requests).toHaveLength(0);
    });

    it("stops with 'deadline' once the deadline has passed", async () => {
        const { provider, requests } = fakeProvider({ t: "x" });

        const summary = await runHarness({
            provider,
            tasks: [{ id: "t", description: "x" }],
            apply: () => {},
            limits: { deadline: new Date(Date.now() - 1000) },
        });

        expect(requests).toHaveLength(0);
        expect(summary.stoppedBy).toBe("deadline");
    });

    it("records an 'Unexpected error' and retries when the provider throws", async () => {
        const tasks: Task[] = [{ id: "t", description: "boom" }];
        const events: HarnessEvent["type"][] = [];
        const provider: AgentProvider = {
            id: "anthropic",
            model: "fake-model",
            async complete(): Promise<CompletionResult> {
                throw new Error("kaboom");
            },
        };

        const summary = await runHarness({
            provider,
            tasks,
            apply: () => {},
            onEvent: (e) => events.push(e.type),
            limits: { maxAttempts: 2, pauseBetweenTasksMs: 0 },
        });

        expect(summary.failed).toBe(1);
        expect(summary.stoppedBy).toBe("exhausted");
        expect(tasks[0].lastFeedback).toContain("Unexpected error:");
        expect(tasks[0].lastFeedback).toContain("kaboom");
        expect(events).toEqual([
            "task-start",
            "task-retry",
            "task-start",
            "task-failed",
            "stop",
        ]);
    });

    it("treats an apply() throw the same as any other unexpected error", async () => {
        const tasks: Task[] = [{ id: "t", description: "x" }];
        const { provider } = fakeProvider({ t: "code" });

        const summary = await runHarness({
            provider,
            tasks,
            apply: () => {
                throw new Error("apply failed");
            },
            limits: { maxAttempts: 1, pauseBetweenTasksMs: 0 },
        });

        expect(summary.failed).toBe(1);
        expect(tasks[0].lastFeedback).toContain("apply failed");
        expect(tasks[0].status).toBe("failed");
    });

    it("resolves the inter-task delay immediately when already aborted", async () => {
        const controller = new AbortController();
        const tasks: Task[] = [
            { id: "a", description: "a" },
            { id: "b", description: "b" },
        ];
        const applied: string[] = [];
        const { provider } = fakeProvider({ a: "1", b: "2" });

        const summary = await runHarness({
            provider,
            tasks,
            apply: ({ task }) => {
                applied.push(task.id);
                // Abort during the apply of the first task, before the pause
                // begins, so delay() takes its already-aborted fast path.
                controller.abort();
            },
            signal: controller.signal,
            limits: { pauseBetweenTasksMs: 10_000 },
        });

        expect(applied).toEqual(["a"]); // second task never starts
        expect(summary.stoppedBy).toBe("aborted");
    });

    it("interrupts a pending inter-task delay when the signal aborts", async () => {
        const controller = new AbortController();
        const tasks: Task[] = [
            { id: "a", description: "a" },
            { id: "b", description: "b" },
        ];
        const applied: string[] = [];
        const { provider } = fakeProvider({ a: "1", b: "2" });

        const summary = await runHarness({
            provider,
            tasks,
            apply: ({ task }) => {
                applied.push(task.id);
                if (task.id === "a") {
                    // Fire after delay() has started its (long) timer, so the
                    // abort listener — not the timeout — resolves it.
                    setTimeout(() => controller.abort(), 5);
                }
            },
            signal: controller.signal,
            limits: { pauseBetweenTasksMs: 10_000 },
        });

        expect(applied).toEqual(["a"]);
        expect(summary.stoppedBy).toBe("aborted");
    });

    it("emits the event sequence with the model-result cost", async () => {
        const tasks: Task[] = [{ id: "t", description: "x" }];
        const { provider } = fakeProvider({ t: "out" });
        const events: HarnessEvent[] = [];

        await runHarness({
            provider,
            tasks,
            apply: () => {},
            estimateCost: () => 0.25,
            onEvent: (e) => events.push(e),
            limits: { pauseBetweenTasksMs: 0 },
        });

        expect(events.map((e) => e.type)).toEqual([
            "task-start",
            "model-result",
            "task-done",
            "stop",
        ]);
        const modelResult = events.find((e) => e.type === "model-result");
        expect(modelResult).toMatchObject({
            type: "model-result",
            costUSD: 0.25,
        });
        expect(
            (modelResult as Extract<HarnessEvent, { type: "model-result" }>)
                .result.text,
        ).toBe("out");
    });

    it("emits the resolving provider on the model-result event", async () => {
        const tasks: Task[] = [{ id: "t", description: "x" }];
        const { provider } = fakeProvider({ t: "out" });
        const events: HarnessEvent[] = [];

        await runHarness({
            provider,
            tasks,
            apply: () => {},
            onEvent: (e) => events.push(e),
            limits: { pauseBetweenTasksMs: 0 },
        });

        const modelResult = events.find(
            (e) => e.type === "model-result",
        ) as Extract<HarnessEvent, { type: "model-result" }>;
        expect(modelResult.provider).toBe(provider);
    });

    it("prefers resolveProvider over the default provider, per task", async () => {
        const tasks: Task[] = [
            { id: "a", description: "a", provider: "openai" },
            { id: "b", description: "b" },
        ];
        const fallback = fakeProvider({ a: "1", b: "2" });
        const special = fakeProvider({ a: "1", b: "2" });
        const usedFor: Record<string, string> = {};

        await runHarness({
            provider: fallback.provider,
            resolveProvider: (task) =>
                task.provider === "openai" ? special.provider : undefined,
            tasks,
            apply: () => {},
            onEvent: (e) => {
                if (e.type === "model-result") {
                    usedFor[e.task.id] =
                        e.provider === special.provider
                            ? "special"
                            : "fallback";
                }
            },
            limits: { pauseBetweenTasksMs: 0 },
        });

        // resolveProvider handled task "a"; task "b" fell back to config.provider.
        expect(usedFor).toEqual({ a: "special", b: "fallback" });
        expect(special.requests).toHaveLength(1);
        expect(fallback.requests).toHaveLength(1);
    });

    it("awaits an async resolveProvider", async () => {
        const tasks: Task[] = [{ id: "t", description: "x" }];
        const { provider, requests } = fakeProvider({ t: "out" });

        const summary = await runHarness({
            resolveProvider: async () => provider,
            tasks,
            apply: () => {},
            limits: { pauseBetweenTasksMs: 0 },
        });

        expect(requests).toHaveLength(1);
        expect(summary.done).toBe(1);
    });

    it("fails the task with a clear error when no provider can be resolved", async () => {
        const tasks: Task[] = [{ id: "t", description: "x" }];

        const summary = await runHarness({
            tasks,
            apply: () => {},
            limits: { maxAttempts: 1, pauseBetweenTasksMs: 0 },
        });

        expect(summary.failed).toBe(1);
        expect(tasks[0].lastFeedback).toContain('no provider for task "t"');
    });

    it("resolves task.skills against the registry and passes them to buildPrompt", async () => {
        const tasks: Task[] = [
            { id: "t", description: "x", skills: ["tdd", "sql-safe"] },
        ];
        const { provider } = fakeProvider({ t: "out" });
        let seenSkills: { name: string; instructions: string }[] = [];

        await runHarness({
            provider,
            tasks,
            skills: {
                tdd: "Write a failing test first.",
                "sql-safe": {
                    name: "SQL safety",
                    instructions: "Never concatenate SQL.",
                },
            },
            apply: () => {},
            buildPrompt: ({ skills }) => {
                seenSkills = (skills ?? []).map((s) => ({
                    name: s.name,
                    instructions: s.instructions,
                }));
                return { messages: [{ role: "user", content: "x" }] };
            },
            limits: { pauseBetweenTasksMs: 0 },
        });

        expect(seenSkills).toEqual([
            { name: "tdd", instructions: "Write a failing test first." },
            { name: "SQL safety", instructions: "Never concatenate SQL." },
        ]);
    });

    it("fails the task when it references an unknown skill", async () => {
        const tasks: Task[] = [
            { id: "t", description: "x", skills: ["missing"] },
        ];
        const { provider } = fakeProvider({ t: "out" });

        const summary = await runHarness({
            provider,
            tasks,
            skills: { tdd: "..." },
            apply: () => {},
            limits: { maxAttempts: 1, pauseBetweenTasksMs: 0 },
        });

        expect(summary.failed).toBe(1);
        expect(tasks[0].lastFeedback).toContain('unknown skill "missing"');
    });

    it("uses a custom buildPrompt override and passes it the task list", async () => {
        const tasks: Task[] = [{ id: "t", description: "x" }];
        const { provider, requests } = fakeProvider({});
        const seen: { taskId: string; taskCount: number }[] = [];

        await runHarness({
            provider,
            tasks,
            apply: () => {},
            buildPrompt: ({ task, tasks: all }) => {
                seen.push({ taskId: task.id, taskCount: all.length });
                return {
                    messages: [{ role: "user", content: "CUSTOM PROMPT" }],
                };
            },
            limits: { pauseBetweenTasksMs: 0 },
        });

        expect(seen).toEqual([{ taskId: "t", taskCount: 1 }]);
        expect(requests[0]?.messages[0]?.content).toBe("CUSTOM PROMPT");
    });
});
