import { type ContractVersion, version } from "../versioning/version.js";
import { AppError } from "../errors/index.js";
import type { Result } from "../result/result.js";

import type { LoggerPort } from "./ports/logger.port.js";
import type { MetricsPort } from "./ports/metrics.port.js";
import type { TraceAttributeValue, TracerPort } from "./ports/tracer.port.js";

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
        return (this.constructor as typeof UseCase).CONTRACT_VERSION;
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

    /**
     * Extra attributes stamped onto the span and every metric emitted for this
     * execution. Override to attach stable, **low-cardinality** dimensions
     * (e.g. `Command` adds `requested_by.kind`). Keep values bounded — they
     * become metric label values, so a user id or free-form string here would
     * explode the metric's cardinality. Defaults to none.
     */
    protected spanAttributes(
        _input: Input,
    ): Readonly<Record<string, TraceAttributeValue>> {
        return {};
    }

    private async runInstrumented(
        input: Input,
        observability: UseCaseObservability,
    ): Promise<Output> {
        const { logger, metrics, tracer } = observability;
        const name = this.useCaseName;
        const attributes = safely(() => this.spanAttributes(input)) ?? {};
        const span = safely(() =>
            tracer?.startSpan(name, { "use_case.name": name, ...attributes }),
        );
        const startedAt = performance.now();
        // Declared here (not inside `try`) so the `finally` histogram can label
        // duration by outcome; defaults to "exception" and is overwritten once
        // execute() returns without throwing.
        let outcome: ExecutionOutcome = "exception";

        try {
            const output = await this.execute(input);
            outcome = output.isOk() ? "ok" : "error";

            if (outcome === "error") {
                const code = businessErrorCode(output);
                safely(() =>
                    logger?.warn(`${name} returned a business error`, {
                        useCase: name,
                        ...(code ? { code } : {}),
                    }),
                );
            }
            safely(() => span?.setAttribute("use_case.outcome", outcome));
            safely(() =>
                metrics?.counter(EXECUTION_COUNTER, 1, {
                    useCase: name,
                    outcome,
                    ...attributes,
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
                    ...attributes,
                }),
            );

            throw error;
        } finally {
            safely(() =>
                metrics?.histogram(
                    DURATION_HISTOGRAM,
                    performance.now() - startedAt,
                    { useCase: name, outcome, ...attributes },
                ),
            );
            safely(() => span?.end());
        }
    }
}

/**
 * Pulls the stable `code` off a business-error `Result` for logging. Returns
 * `undefined` when the error is not an {@link AppError} — the code is safe to
 * log (it's the public contract), unlike the message which may carry PII.
 */
function businessErrorCode(
    output: Result<unknown, unknown>,
): string | undefined {
    const error = output.errorOrNull();
    return error instanceof AppError ? error.code : undefined;
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
