import type {
    AgentProvider,
    CompletionRequest,
    CompletionResult,
    TokenUsage,
} from "../providers/types.js";

export type TaskStatus = "pending" | "done" | "failed";

/**
 * A unit of work for the agent. Deliberately architecture-neutral: it does not
 * assume tests, target files, or any particular toolchain. Anything domain- or
 * stack-specific belongs in `context` (injected into the prompt) or `metadata`
 * (read by your own `apply`/`verify` strategies).
 */
export interface Task {
    id: string;
    description: string;
    status?: TaskStatus;
    /** IDs of tasks that must be "done" before this one becomes runnable. */
    dependsOn?: string[];
    attempts?: number;
    /** Sensor feedback from the previous attempt; fed back into the next prompt. */
    lastFeedback?: string | null;
    /** Summary recorded when the task is marked done. */
    outputSummary?: string | null;
    /** Extra free-form context appended to the prompt for this task. */
    context?: string;
    /** Anything your strategies need (e.g. target files, module name). */
    metadata?: Record<string, unknown>;
}

export interface HarnessLimits {
    /** Max attempts per task before it is marked failed. */
    maxAttempts: number;
    /** Stop once accumulated cost reaches this (USD). Omit for no cost cap. */
    maxCostUSD?: number;
    /** Stop once this moment passes. Omit for no deadline. */
    deadline?: Date | null;
    /** Delay between tasks, e.g. to respect rate limits. */
    pauseBetweenTasksMs?: number;
}

export interface VerifyOutcome {
    passed: boolean;
    /** When failing, the feedback handed to the agent on the next attempt. */
    feedback?: string;
}

export interface BuildPromptArgs {
    task: Task;
    tasks: readonly Task[];
}
export type BuildPromptFn = (
    args: BuildPromptArgs,
) => CompletionRequest | Promise<CompletionRequest>;

export interface ApplyArgs {
    task: Task;
    result: CompletionResult;
}
/** Consumer-supplied step that does something with the model output (write files, etc.). */
export type ApplyFn = (args: ApplyArgs) => void | Promise<void>;

export interface VerifyArgs {
    task: Task;
}
/** Optional consumer-supplied check that decides whether the attempt succeeded. */
export type VerifyFn = (
    args: VerifyArgs,
) => VerifyOutcome | Promise<VerifyOutcome>;

export type CostEstimator = (
    usage: TokenUsage,
    provider: AgentProvider,
) => number;

export type StopReason =
    | "deadline"
    | "cost"
    | "aborted"
    | "exhausted"
    | "complete";

export type HarnessEvent =
    | { type: "task-start"; task: Task; attempt: number }
    | {
          type: "model-result";
          task: Task;
          result: CompletionResult;
          costUSD: number;
      }
    | { type: "task-done"; task: Task }
    | { type: "task-failed"; task: Task; feedback?: string }
    | { type: "task-retry"; task: Task; feedback?: string }
    | { type: "stop"; reason: StopReason };

export interface HarnessConfig {
    provider: AgentProvider;
    tasks: Task[];
    /** What to do with each model result (the only required strategy). */
    apply: ApplyFn;
    /** Optional success check. When omitted, an attempt succeeds once `apply` resolves. */
    verify?: VerifyFn;
    /** Override how a task becomes a prompt. Defaults to a generic template. */
    buildPrompt?: BuildPromptFn;
    limits?: Partial<HarnessLimits>;
    /** Map token usage to USD for the cost cap. Defaults to 0 (no cost tracking). */
    estimateCost?: CostEstimator;
    /** Observe progress (logging, metrics, UI). */
    onEvent?: (event: HarnessEvent) => void;
    /** Cooperative cancellation — abort between/within tasks. */
    signal?: AbortSignal;
}

export interface HarnessSummary {
    done: number;
    failed: number;
    pending: number;
    totalCostUSD: number;
    stoppedBy: StopReason;
}
