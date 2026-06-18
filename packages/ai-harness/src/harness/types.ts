import type {
    AgentProvider,
    CompletionRequest,
    CompletionResult,
    ProviderName,
    TokenUsage,
} from "../providers/types.js";

export type TaskStatus = "pending" | "done" | "failed";

/**
 * A reusable, named block of instructions injected into the prompt. Register
 * skills on `HarnessConfig.skills` and reference them by name from
 * `Task.skills`; the harness resolves names to `Skill`s and the default prompt
 * renders them under a `# Skills` section.
 */
export interface Skill {
    /** Display name, rendered as the section heading. Defaults to the registry key. */
    name: string;
    /** The instruction text injected into the prompt. */
    instructions: string;
    /** Optional one-line summary (not rendered by the default prompt). */
    description?: string;
}

/**
 * Maps a skill name to its instructions. A plain string is shorthand for a
 * `Skill` whose `name` is the registry key and whose `instructions` are the
 * string.
 */
export type SkillRegistry = Record<string, string | Skill>;

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
    /**
     * Vendor to run this task on. Read by `config.resolveProvider` (e.g. the
     * bundled `createProviderResolver`) to pick the `AgentProvider` per task.
     */
    provider?: ProviderName;
    /** Model id for this task, e.g. "claude-opus-4-8". Consumed by `resolveProvider`. */
    model?: string;
    /** Names of `HarnessConfig.skills` to inject into this task's prompt. */
    skills?: string[];
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
    /** Skills referenced by `task.skills`, already resolved against the registry. */
    skills?: readonly Skill[];
}

/**
 * Resolve the `AgentProvider` for a task. Return `undefined` to fall back to
 * `HarnessConfig.provider`. The harness never reads API keys itself, so this is
 * where per-task provider/model selection (e.g. `createProviderResolver`) lives.
 */
export type ProviderResolver = (
    task: Task,
) => AgentProvider | Promise<AgentProvider> | undefined;
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
          /** The provider that produced this result (per-task when resolved). */
          provider: AgentProvider;
      }
    | { type: "task-done"; task: Task }
    | { type: "task-failed"; task: Task; feedback?: string }
    | { type: "task-retry"; task: Task; feedback?: string }
    | { type: "stop"; reason: StopReason };

export interface HarnessConfig {
    /**
     * Default provider, used when `resolveProvider` is absent or returns
     * `undefined`. Optional only if `resolveProvider` covers every task; a task
     * with no provider from either source throws at run time.
     */
    provider?: AgentProvider;
    /** Pick the provider per task (e.g. `createProviderResolver`). */
    resolveProvider?: ProviderResolver;
    tasks: Task[];
    /** Named, reusable instruction blocks referenced by `Task.skills`. */
    skills?: SkillRegistry;
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
