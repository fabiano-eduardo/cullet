import { type ContractVersion, version } from "../versioning/version.js";
import type { Result } from "../result/result.js";

import type { LoggerPort } from "./ports/logger.port.js";
import type { MetricsPort } from "./ports/metrics.port.js";
import type { TracerPort } from "./ports/tracer.port.js";

type MaybePromise<T> = T | Promise<T>;

/**
 * Observability adapters a use case may opt into.
 *
 * All fields are optional: a use case that provides none keeps the plain
 * `input → Result` behavior with zero overhead. When provided, {@link UseCase.run}
 * instruments every execution around `execute()` — opening a span, recording
 * duration, counting outcomes, and logging business/unexpected failures.
 */
interface UseCaseObservability {
    readonly logger?: LoggerPort;
    readonly metrics?: MetricsPort;
    readonly tracer?: TracerPort;
}

const EXECUTION_COUNTER = "use_case.executions";
const DURATION_HISTOGRAM = "use_case.duration_ms";

type ExecutionOutcome = "ok" | "error" | "exception";

@version("1.0")
abstract class UseCase<
    Input = void,
    Output extends Result<unknown, unknown> = Result<void, never>,
> {
    declare public static readonly CONTRACT_VERSION: ContractVersion;

    public get contractVersion(): ContractVersion {
        return UseCase.CONTRACT_VERSION;
    }

    /**
     * Runs the use case.
     *
     * `run()` is the single seam every use case crosses, so it is where
     * cross-cutting instrumentation lives. When {@link observability} exposes
     * any adapter, the call to `execute()` is wrapped with tracing, metrics and
     * failure logging; otherwise it delegates directly with no overhead.
     *
     * Observability is strictly side-effecting: a misbehaving adapter never
     * changes the business result nor masks a thrown error — its own failures
     * are swallowed.
     */
    public async run(input: Input): Promise<Output> {
        const observability = this.observability();
        if (
            !observability.logger &&
            !observability.metrics &&
            !observability.tracer
        ) {
            return await this.execute(input);
        }

        return await this.runInstrumented(input, observability);
    }

    /**
     * Adapters used to instrument {@link run}. Override to opt a use case into
     * tracing/metrics/logging. Returns an empty object by default, which keeps
     * the plain delegating behavior.
     */
    protected observability(): UseCaseObservability {
        return {};
    }

    /**
     * Stable identity used for span names and metric labels. Defaults to the
     * runtime class name; override when bundling/minification would otherwise
     * erase a meaningful name.
     */
    protected get useCaseName(): string {
        return this.constructor.name;
    }

    protected abstract execute(input: Input): MaybePromise<Output>;

    private async runInstrumented(
        input: Input,
        observability: UseCaseObservability,
    ): Promise<Output> {
        const { logger, metrics, tracer } = observability;
        const name = this.useCaseName;
        const span = safely(() =>
            tracer?.startSpan(name, { "use_case.name": name }),
        );
        const startedAt = Date.now();

        try {
            const output = await this.execute(input);
            const outcome: ExecutionOutcome = output.isOk() ? "ok" : "error";

            if (outcome === "error") {
                safely(() =>
                    logger?.warn(`${name} returned a business error`, {
                        useCase: name,
                    }),
                );
            }
            safely(() => span?.setAttribute("use_case.outcome", outcome));
            safely(() =>
                metrics?.counter(EXECUTION_COUNTER, 1, {
                    useCase: name,
                    outcome,
                }),
            );

            return output;
        } catch (error) {
            safely(() =>
                logger?.error(`${name} threw an unexpected error`, {
                    useCase: name,
                }),
            );
            safely(() => span?.setAttribute("use_case.outcome", "exception"));
            safely(() => span?.recordException(error));
            safely(() =>
                metrics?.counter(EXECUTION_COUNTER, 1, {
                    useCase: name,
                    outcome: "exception",
                }),
            );

            throw error;
        } finally {
            safely(() =>
                metrics?.histogram(DURATION_HISTOGRAM, Date.now() - startedAt, {
                    useCase: name,
                }),
            );
            safely(() => span?.end());
        }
    }
}

/**
 * Invokes an observability side effect, isolating any adapter failure so it
 * cannot alter the use case outcome.
 */
function safely<R>(effect: () => R): R | undefined {
    try {
        return effect();
    } catch {
        return undefined;
    }
}

export { type MaybePromise, UseCase, type UseCaseObservability };
