import { describe, expect, it } from "vitest";

import { BusinessRuleViolationError } from "../errors/index.js";
import { Result } from "../result/result.js";

import type { LogPayload, LoggerPort } from "./ports/logger.port.js";
import type { MetricLabels, MetricsPort } from "./ports/metrics.port.js";
import type {
    TraceAttributeValue,
    TraceSpan,
    TracerPort,
} from "./ports/tracer.port.js";
import { UseCase, type UseCaseObservability } from "./use-case.js";

interface LogCall {
    readonly level: "debug" | "info" | "warn" | "error";
    readonly message: string;
    readonly payload?: LogPayload;
}

class RecordingLogger implements LoggerPort {
    readonly calls: LogCall[] = [];

    debug(message: string, payload?: LogPayload): void {
        this.calls.push({ level: "debug", message, payload });
    }
    info(message: string, payload?: LogPayload): void {
        this.calls.push({ level: "info", message, payload });
    }
    warn(message: string, payload?: LogPayload): void {
        this.calls.push({ level: "warn", message, payload });
    }
    error(message: string, payload?: LogPayload): void {
        this.calls.push({ level: "error", message, payload });
    }
}

interface MetricCall {
    readonly type: "counter" | "gauge" | "histogram";
    readonly name: string;
    readonly value: number;
    readonly labels?: MetricLabels;
}

class RecordingMetrics implements MetricsPort {
    readonly calls: MetricCall[] = [];

    counter(name: string, value: number, labels?: MetricLabels): void {
        this.calls.push({ type: "counter", name, value, labels });
    }
    gauge(name: string, value: number, labels?: MetricLabels): void {
        this.calls.push({ type: "gauge", name, value, labels });
    }
    histogram(name: string, value: number, labels?: MetricLabels): void {
        this.calls.push({ type: "histogram", name, value, labels });
    }
}

class RecordingSpan implements TraceSpan {
    readonly attributes: Record<string, TraceAttributeValue> = {};
    readonly exceptions: unknown[] = [];
    ended = false;

    constructor(
        readonly name: string,
        readonly startAttributes?: Record<string, TraceAttributeValue>,
    ) {}

    setAttribute(key: string, value: TraceAttributeValue): void {
        this.attributes[key] = value;
    }
    recordException(error: unknown): void {
        this.exceptions.push(error);
    }
    end(): void {
        this.ended = true;
    }
}

class RecordingTracer implements TracerPort {
    readonly spans: RecordingSpan[] = [];

    startSpan(
        name: string,
        attributes?: Record<string, TraceAttributeValue>,
    ): TraceSpan {
        const span = new RecordingSpan(name, attributes);
        this.spans.push(span);
        return span;
    }
}

class InstrumentedUseCase extends UseCase<number, Result<number, string>> {
    constructor(private readonly ports: UseCaseObservability) {
        super();
    }

    protected observability(): UseCaseObservability {
        return this.ports;
    }

    protected execute(input: number): Result<number, string> {
        if (input < 0) {
            return Result.err("negative input");
        }
        return Result.ok(input * 2);
    }
}

class ThrowingUseCase extends UseCase<void, Result<void, never>> {
    readonly boom = new Error("kaboom");

    constructor(private readonly ports: UseCaseObservability) {
        super();
    }

    protected observability(): UseCaseObservability {
        return this.ports;
    }

    protected execute(): Result<void, never> {
        throw this.boom;
    }
}

describe("UseCase observability", () => {
    it("does not touch execute() output when no adapter is provided", async () => {
        const useCase = new InstrumentedUseCase({});

        const result = await useCase.run(4);

        expect(result.isOk()).toBe(true);
        expect(result.getOrNull()).toBe(8);
    });

    it("opens and ends a span named after the use case on success", async () => {
        const tracer = new RecordingTracer();
        const useCase = new InstrumentedUseCase({ tracer });

        await useCase.run(4);

        expect(tracer.spans).toHaveLength(1);
        const [span] = tracer.spans;
        expect(span.name).toBe("InstrumentedUseCase");
        expect(span.startAttributes).toEqual({
            "use_case.name": "InstrumentedUseCase",
        });
        expect(span.attributes["use_case.outcome"]).toBe("ok");
        expect(span.ended).toBe(true);
        expect(span.exceptions).toHaveLength(0);
    });

    it("records a duration histogram (labelled by outcome) and an ok counter on success", async () => {
        const metrics = new RecordingMetrics();
        const useCase = new InstrumentedUseCase({ metrics });

        await useCase.run(4);

        const counter = metrics.calls.find((c) => c.type === "counter");
        const histogram = metrics.calls.find((c) => c.type === "histogram");

        expect(counter).toMatchObject({
            name: "use_case.executions",
            value: 1,
            labels: { useCase: "InstrumentedUseCase", outcome: "ok" },
        });
        expect(histogram).toMatchObject({
            name: "use_case.duration_ms",
            labels: { useCase: "InstrumentedUseCase", outcome: "ok" },
        });
        expect(histogram?.value).toBeGreaterThanOrEqual(0);
    });

    it("logs a warning and marks the outcome as error on a business error", async () => {
        const logger = new RecordingLogger();
        const metrics = new RecordingMetrics();
        const tracer = new RecordingTracer();
        const useCase = new InstrumentedUseCase({ logger, metrics, tracer });

        const result = await useCase.run(-1);

        expect(result.isErr()).toBe(true);
        expect(result.errorOrNull()).toBe("negative input");

        expect(logger.calls).toHaveLength(1);
        expect(logger.calls[0]).toMatchObject({ level: "warn" });

        expect(tracer.spans[0].attributes["use_case.outcome"]).toBe("error");
        expect(tracer.spans[0].ended).toBe(true);

        expect(
            metrics.calls.find((c) => c.type === "histogram")?.labels,
        ).toMatchObject({ outcome: "error" });
        expect(
            metrics.calls.find((c) => c.type === "counter")?.labels,
        ).toMatchObject({ outcome: "error" });
    });

    it("includes the AppError code in the business-error warn payload", async () => {
        const error = new BusinessRuleViolationError("cart.empty", "cart empty");
        const logger = new RecordingLogger();

        class FailingUseCase extends UseCase<
            void,
            Result<void, BusinessRuleViolationError>
        > {
            protected observability(): UseCaseObservability {
                return { logger };
            }
            protected execute(): Result<void, BusinessRuleViolationError> {
                return Result.err(error);
            }
        }

        await new FailingUseCase().run();

        expect(logger.calls[0]).toMatchObject({
            level: "warn",
            payload: { useCase: "FailingUseCase", code: error.code },
        });
    });

    it("logs, records the exception and rethrows the original error", async () => {
        const logger = new RecordingLogger();
        const metrics = new RecordingMetrics();
        const tracer = new RecordingTracer();
        const useCase = new ThrowingUseCase({ logger, metrics, tracer });

        await expect(useCase.run()).rejects.toBe(useCase.boom);

        expect(logger.calls[0]).toMatchObject({ level: "error" });

        const span = tracer.spans[0];
        expect(span.attributes["use_case.outcome"]).toBe("exception");
        expect(span.exceptions).toEqual([useCase.boom]);
        expect(span.ended).toBe(true);

        expect(
            metrics.calls.find((c) => c.type === "counter")?.labels,
        ).toMatchObject({ outcome: "exception" });
        // duration is still recorded on the failure path, labelled "exception"
        expect(
            metrics.calls.find((c) => c.type === "histogram")?.labels,
        ).toMatchObject({ outcome: "exception" });
    });

    it("uses an overridden useCaseName for span and labels", async () => {
        const tracer = new RecordingTracer();
        const metrics = new RecordingMetrics();

        class NamedUseCase extends InstrumentedUseCase {
            protected override get useCaseName(): string {
                return "checkout.place-order";
            }
        }

        const useCase = new NamedUseCase({ tracer, metrics });
        await useCase.run(1);

        expect(tracer.spans[0].name).toBe("checkout.place-order");
        expect(
            metrics.calls.find((c) => c.type === "counter")?.labels,
        ).toMatchObject({ useCase: "checkout.place-order" });
    });

    it("never lets a misbehaving adapter alter the business result", async () => {
        const boom = () => {
            throw new Error("adapter down");
        };
        const useCase = new InstrumentedUseCase({
            logger: { debug: boom, info: boom, warn: boom, error: boom },
            metrics: { counter: boom, gauge: boom, histogram: boom },
            tracer: { startSpan: boom },
        });

        const result = await useCase.run(4);

        expect(result.isOk()).toBe(true);
        expect(result.getOrNull()).toBe(8);
    });
});
