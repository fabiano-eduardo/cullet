import { type CoreConfig, coreConfig } from "../../config/index.js";
import type { Result } from "../../result/result.js";

import { ComputeEngineRegistry } from "./compute-engine-registry.js";
import { ComputeEvaluatorRegistry } from "./compute-evaluator-registry.js";
import type { PolicyContext } from "./gate-types.js";
import type {
    ComputeEvaluator,
    ComputeEvaluatorRegistration,
    ComputeOutcome,
    VersionedComputeEngine,
} from "./compute-types.js";
import { ComputeEngineV1 } from "./v1/compute/index.js";

export interface ComputeRegistryOptions {
    readonly coreConfig?: CoreConfig;
}

export class ComputeRegistry {
    private readonly engines = new ComputeEngineRegistry();
    private readonly evaluators = new ComputeEvaluatorRegistry();

    constructor(params: ComputeRegistryOptions = {}) {
        const resolvedCoreConfig = params.coreConfig ?? coreConfig;

        this.engines.register(
            new ComputeEngineV1({
                coreConfig: resolvedCoreConfig,
            }),
        );
    }

    register(registration: ComputeEvaluatorRegistration): void {
        this.evaluators.register(registration);
    }

    registerEngine(engine: VersionedComputeEngine): void {
        this.engines.register(engine);
    }

    getEngine(version: number): VersionedComputeEngine | undefined {
        return this.engines.get(version);
    }

    getEvaluator(
        policyKey: string,
        version: number,
    ): ComputeEvaluator | undefined {
        return this.evaluators.get(policyKey, version);
    }

    evaluate(
        policyKey: string,
        computeEngineVersion: number,
        payloadSchemaVersion: number,
        payload: unknown,
        context: PolicyContext,
    ): Result<ComputeOutcome, string> {
        return this.engines.evaluate(computeEngineVersion, {
            policyKey,
            payloadSchemaVersion,
            payload,
            context,
            evaluators: this.evaluators,
        });
    }
}
