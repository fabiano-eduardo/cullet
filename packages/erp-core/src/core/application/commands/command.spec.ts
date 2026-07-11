import { describe, expect, it } from "vitest";

import type { MetricLabels, MetricsPort } from "../ports/metrics.port.js";
import type {
    TraceAttributeValue,
    TraceSpan,
    TracerPort,
} from "../ports/tracer.port.js";
import { Result } from "../../result/result.js";
import { UseCase, type UseCaseObservability } from "../use-case.js";

import { Command } from "./command.js";
import { RequestedBy } from "./requested-by.js";

class SaveEntityCommand extends Command<
    { id: string; requestedBy: RequestedBy },
    Result<void, never>
> {
    protected execute(_input: {
        id: string;
        requestedBy: RequestedBy;
    }): Result<void, never> {
        // side effects would happen here (persistence, events, etc.)
        return Result.ok(undefined);
    }
}

class ComputeAndReturnCommand extends Command<
    { value: number; requestedBy: RequestedBy },
    Result<number, never>
> {
    protected execute(input: {
        value: number;
        requestedBy: RequestedBy;
    }): Result<number, never> {
        return Result.ok(input.value + 1);
    }
}

describe("Command", () => {
    it("is a subclass of UseCase", () => {
        const command = new SaveEntityCommand();

        expect(command).toBeInstanceOf(UseCase);
    });

    it("executes via run() and returns the output of execute()", async () => {
        const command = new ComputeAndReturnCommand();
        const result = await command.run({
            value: 9,
            requestedBy: RequestedBy.fromSystem("system:test-job"),
        });

        expect(result.isOk()).toBe(true);
        expect(result.getOrNull()).toBe(10);
    });

    it("inherits CONTRACT_VERSION from UseCase", () => {
        expect(Command.CONTRACT_VERSION).toBe("1.0");
    });

    it("inherits the contractVersion getter on the instance", () => {
        const command = new SaveEntityCommand();

        expect(command.contractVersion).toBe("1.0");
    });

    it("stamps requested_by.kind on the span and metric labels (never the raw id)", async () => {
        const spanAttributes: Record<string, TraceAttributeValue> = {};
        const span: TraceSpan = {
            setAttribute: (k, v) => {
                spanAttributes[k] = v;
            },
            recordException: () => {},
            end: () => {},
        };
        let startAttributes: Record<string, TraceAttributeValue> | undefined;
        const tracer: TracerPort = {
            startSpan: (_name, attributes) => {
                startAttributes = attributes;
                return span;
            },
        };
        const counterLabels: MetricLabels[] = [];
        const metrics: MetricsPort = {
            counter: (_n, _v, labels) => {
                if (labels) counterLabels.push(labels);
            },
            gauge: () => {},
            histogram: () => {},
        };

        class InstrumentedCommand extends Command<{
            requestedBy: RequestedBy;
        }> {
            protected override observability(): UseCaseObservability {
                return { tracer, metrics };
            }
            protected execute(): Result<void, never> {
                return Result.ok(undefined);
            }
        }

        const userId = "550e8400-e29b-41d4-a716-446655440000";
        await new InstrumentedCommand().run({
            requestedBy: RequestedBy.fromUser(userId),
        });

        expect(startAttributes).toMatchObject({ "requested_by.kind": "user" });
        expect(counterLabels[0]).toMatchObject({ "requested_by.kind": "user" });
        // the raw user id never reaches the span/metrics
        expect(JSON.stringify({ startAttributes, counterLabels })).not.toContain(
            userId,
        );
    });
});
