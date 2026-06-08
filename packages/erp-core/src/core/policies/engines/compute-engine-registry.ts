import { Result } from "../../result/result";

import type { PolicyContext } from "./gate-types";
import { ComputePayloadParsers } from "./parse-compute-payload";
import type { ComputeEvaluatorRegistry } from "./compute-evaluator-registry";
import type { ComputeOutcome, VersionedComputeEngine } from "./compute-types";

export class ComputeEngineRegistry {
    private readonly engines = new Map<number, VersionedComputeEngine>();

    register(engine: VersionedComputeEngine): void {
        this.engines.set(engine.version, engine);
    }

    get(version: number): VersionedComputeEngine | undefined {
        return this.engines.get(version);
    }

    evaluate(
        version: number,
        params: {
            readonly policyKey: string;
            readonly payloadSchemaVersion: number;
            readonly payload: unknown;
            readonly context: PolicyContext;
            readonly evaluators: ComputeEvaluatorRegistry;
        },
    ): Result<ComputeOutcome, string> {
        const engine = this.get(version);
        if (engine === undefined) {
            return Result.err(
                `No compute engine registered for version "${version}"`,
            );
        }

        const evaluator = params.evaluators.get(params.policyKey, version);
        if (evaluator === undefined) {
            return Result.err(
                `No compute evaluator registered for policy key "${params.policyKey}" and version "${version}"`,
            );
        }

        const parsedPayloadResult = ComputePayloadParsers.parse(
            params.payloadSchemaVersion,
            params.payload,
        );
        if (parsedPayloadResult.isErr()) {
            return Result.err(parsedPayloadResult.errorOrNull()!);
        }

        return engine.evaluate(
            parsedPayloadResult.getOrNull()!,
            params.context,
            evaluator,
        );
    }
}
