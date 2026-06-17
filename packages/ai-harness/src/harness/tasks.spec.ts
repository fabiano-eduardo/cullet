import { describe, expect, it } from "vitest";
import {
    countTasks,
    markDone,
    markFailed,
    nextRunnableTask,
    normalizeTask,
    recordAttempt,
} from "./tasks.js";
import type { Task } from "./types.js";

describe("normalizeTask", () => {
    it("fills in defaults for missing optional fields", () => {
        const normalized = normalizeTask({ id: "t", description: "x" });

        expect(normalized.status).toBe("pending");
        expect(normalized.attempts).toBe(0);
        expect(normalized.dependsOn).toEqual([]);
    });

    it("preserves values that are already set", () => {
        const normalized = normalizeTask({
            id: "t",
            description: "x",
            status: "done",
            attempts: 2,
            dependsOn: ["a", "b"],
        });

        expect(normalized.status).toBe("done");
        expect(normalized.attempts).toBe(2);
        expect(normalized.dependsOn).toEqual(["a", "b"]);
    });

    it("does not mutate the input task", () => {
        const input: Task = { id: "t", description: "x" };
        normalizeTask(input);

        expect(input.status).toBeUndefined();
        expect(input.attempts).toBeUndefined();
        expect(input.dependsOn).toBeUndefined();
    });
});

describe("markDone", () => {
    it("marks the task done, clears feedback, and records the summary", () => {
        const task: Task = {
            id: "t",
            description: "x",
            status: "pending",
            lastFeedback: "previous failure",
        };

        markDone(task, "shipped it");

        expect(task.status).toBe("done");
        expect(task.lastFeedback).toBeNull();
        expect(task.outputSummary).toBe("shipped it");
    });
});

describe("markFailed", () => {
    it("marks the task failed", () => {
        const task: Task = { id: "t", description: "x", status: "pending" };

        markFailed(task);

        expect(task.status).toBe("failed");
    });
});

describe("recordAttempt", () => {
    it("increments attempts and stores the feedback", () => {
        const task: Task = { id: "t", description: "x", attempts: 1 };

        recordAttempt(task, "still broken");

        expect(task.attempts).toBe(2);
        expect(task.lastFeedback).toBe("still broken");
    });

    it("treats a missing attempts count as zero", () => {
        const task: Task = { id: "t", description: "x" };

        recordAttempt(task, "broken");

        expect(task.attempts).toBe(1);
    });
});

describe("countTasks", () => {
    it("counts tasks by status and treats a missing status as pending", () => {
        const tasks: Task[] = [
            { id: "a", description: "", status: "done" },
            { id: "b", description: "", status: "failed" },
            { id: "c", description: "", status: "pending" },
            { id: "d", description: "" }, // no status → pending
        ];

        expect(countTasks(tasks)).toEqual({ done: 1, failed: 1, pending: 2 });
    });

    it("returns zeroed counts for an empty list", () => {
        expect(countTasks([])).toEqual({ done: 0, failed: 0, pending: 0 });
    });
});

describe("nextRunnableTask", () => {
    it("skips tasks whose dependencies are not done", () => {
        const tasks: Task[] = [
            { id: "a", description: "", status: "pending" },
            { id: "b", description: "", status: "pending", dependsOn: ["a"] },
        ];
        expect(nextRunnableTask(tasks, 3)?.id).toBe("a");
    });

    it("returns null once attempts are exhausted", () => {
        const tasks: Task[] = [
            { id: "a", description: "", status: "pending", attempts: 3 },
        ];
        expect(nextRunnableTask(tasks, 3)).toBeNull();
    });
});
