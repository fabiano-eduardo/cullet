// The orchestration loop, expressed as a plain async function (not a CLI script).
// It is provider-agnostic and architecture-neutral: it selects the next runnable
// task, asks the model, hands the result to the consumer's `apply`, optionally
// `verify`s, and retries with feedback until limits are hit.
import type { AgentProvider } from "../providers/types.js";
import { DEFAULT_LIMITS } from "../constants.js";
import { defaultBuildPrompt } from "./prompt.js";
import {
    countTasks,
    markDone,
    markFailed,
    nextRunnableTask,
    recordAttempt,
} from "./tasks.js";
import type {
    HarnessConfig,
    HarnessEvent,
    HarnessLimits,
    HarnessSummary,
    Task,
    VerifyOutcome,
} from "./types.js";

function emit(config: HarnessConfig, event: HarnessEvent): void {
    config.onEvent?.(event);
}

function resolveLimits(
    limits: Partial<HarnessLimits> | undefined,
): HarnessLimits {
    return { ...DEFAULT_LIMITS, ...limits };
}

/**
 * Run the agent over the task list until everything is done, a limit is hit, or
 * the signal aborts. Mutates the task objects in `config.tasks` (status,
 * attempts, feedback) so callers can persist progress between runs.
 */
export async function runHarness(
    config: HarnessConfig,
): Promise<HarnessSummary> {
    const limits = resolveLimits(config.limits);

    // A cost cap with no estimator is inert: every call would be priced at 0, so
    // the cap never trips and spending is effectively unbounded. Fail fast at the
    // entrance instead of leaking silent cost.
    if (limits.maxCostUSD !== undefined && !config.estimateCost) {
        throw new Error(
            `runHarness: limits.maxCostUSD is set (${limits.maxCostUSD}) but no estimateCost ` +
                `was provided. Without an estimator every call costs 0, so the cap would never ` +
                `trip. Pass estimateCost(usage, provider), or drop maxCostUSD.`,
        );
    }

    const provider: AgentProvider = config.provider;
    const buildPrompt = config.buildPrompt ?? defaultBuildPrompt;

    let totalCostUSD = 0;
    let stoppedBy: HarnessSummary["stoppedBy"] = "complete";

    while (true) {
        if (config.signal?.aborted) {
            stoppedBy = "aborted";
            break;
        }
        if (limits.deadline && Date.now() >= limits.deadline.getTime()) {
            stoppedBy = "deadline";
            break;
        }
        if (
            limits.maxCostUSD !== undefined &&
            totalCostUSD >= limits.maxCostUSD
        ) {
            stoppedBy = "cost";
            break;
        }

        const task = nextRunnableTask(config.tasks, limits.maxAttempts);
        if (!task) {
            const { pending, failed } = countTasks(config.tasks);
            // "complete" only when nothing is left and nothing failed; otherwise
            // we ran out of runnable work (blocked deps, exhausted attempts, or
            // failures).
            stoppedBy =
                pending === 0 && failed === 0 ? "complete" : "exhausted";
            break;
        }

        const attempt = (task.attempts ?? 0) + 1;
        emit(config, { type: "task-start", task, attempt });

        try {
            const request = await buildPrompt({ task, tasks: config.tasks });
            const result = await provider.complete(request, config.signal);

            const costUSD = config.estimateCost
                ? config.estimateCost(result.usage, provider)
                : 0;
            totalCostUSD += costUSD;
            emit(config, { type: "model-result", task, result, costUSD });

            await config.apply({ task, result });

            const outcome: VerifyOutcome = config.verify
                ? await config.verify({ task })
                : { passed: true };

            if (outcome.passed) {
                markDone(task, task.outputSummary ?? "Applied successfully.");
                emit(config, { type: "task-done", task });
            } else {
                recordAttempt(
                    task,
                    outcome.feedback ?? "Verification failed without feedback.",
                );
                if ((task.attempts ?? 0) >= limits.maxAttempts) {
                    markFailed(task);
                    emit(config, {
                        type: "task-failed",
                        task,
                        feedback: outcome.feedback,
                    });
                } else {
                    emit(config, {
                        type: "task-retry",
                        task,
                        feedback: outcome.feedback,
                    });
                }
            }
        } catch (err) {
            const feedback = `Unexpected error: ${String(err)}`;
            recordAttempt(task, feedback);
            if ((task.attempts ?? 0) >= limits.maxAttempts) {
                markFailed(task);
                emit(config, { type: "task-failed", task, feedback });
            } else {
                emit(config, { type: "task-retry", task, feedback });
            }
        }

        if (limits.pauseBetweenTasksMs && limits.pauseBetweenTasksMs > 0) {
            await delay(limits.pauseBetweenTasksMs, config.signal);
        }
    }

    emit(config, { type: "stop", reason: stoppedBy });

    const counts = countTasks(config.tasks);
    return { ...counts, totalCostUSD, stoppedBy };
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
    return new Promise((resolve) => {
        if (signal?.aborted) {
            resolve();
            return;
        }
        const timer = setTimeout(resolve, ms);
        signal?.addEventListener(
            "abort",
            () => {
                clearTimeout(timer);
                resolve();
            },
            { once: true },
        );
    });
}

export type { Task };
