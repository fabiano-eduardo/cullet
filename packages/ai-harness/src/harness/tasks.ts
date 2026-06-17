// Pure helpers over the task list. No I/O, no provider calls — easy to unit test.
import type { Task } from "./types.js";

export function normalizeTask(
    task: Task,
): Required<Pick<Task, "status" | "attempts" | "dependsOn">> & Task {
    return {
        ...task,
        status: task.status ?? "pending",
        attempts: task.attempts ?? 0,
        dependsOn: task.dependsOn ?? [],
    };
}

/** The next pending task whose dependencies are all done and whose attempts remain. */
export function nextRunnableTask(
    tasks: readonly Task[],
    maxAttempts: number,
): Task | null {
    const doneIds = new Set(
        tasks
            .filter((t) => (t.status ?? "pending") === "done")
            .map((t) => t.id),
    );

    return (
        tasks.find((t) => {
            const status = t.status ?? "pending";
            const attempts = t.attempts ?? 0;
            if (status !== "pending") return false;
            if (attempts >= maxAttempts) return false;
            return (t.dependsOn ?? []).every((dep) => doneIds.has(dep));
        }) ?? null
    );
}

export function markDone(task: Task, summary: string): void {
    task.status = "done";
    task.lastFeedback = null;
    task.outputSummary = summary;
}

export function markFailed(task: Task): void {
    task.status = "failed";
}

export function recordAttempt(task: Task, feedback: string): void {
    task.attempts = (task.attempts ?? 0) + 1;
    task.lastFeedback = feedback;
}

export interface TaskCounts {
    done: number;
    failed: number;
    pending: number;
}

export function countTasks(tasks: readonly Task[]): TaskCounts {
    return tasks.reduce<TaskCounts>(
        (acc, t) => {
            const status = t.status ?? "pending";
            acc[status] += 1;
            return acc;
        },
        { done: 0, failed: 0, pending: 0 },
    );
}
