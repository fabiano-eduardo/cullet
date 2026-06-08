import { Result } from "../../result/result";

import type {
    GateOutcome,
    PolicyContext,
    VersionedGateEngine,
} from "./gate-types";
import { GatePayloadParsers } from "./parse-gate-payload";

export class GateEngineRegistry {
    private readonly engines = new Map<number, VersionedGateEngine>();

    register(engine: VersionedGateEngine): void {
        this.engines.set(engine.version, engine);
    }

    get(version: number): VersionedGateEngine | undefined {
        return this.engines.get(version);
    }

    evaluate(
        version: number,
        payload: unknown,
        context: PolicyContext,
    ): Result<GateOutcome, string> {
        const engine = this.engines.get(version);
        if (!engine) {
            return Result.err(
                `No gate engine registered for version "${version}"`,
            );
        }

        const parsedPayload = GatePayloadParsers.parse(version, payload);
        if (parsedPayload.isErr()) {
            return Result.err(parsedPayload.errorOrNull()!);
        }

        return engine.evaluate(parsedPayload.getOrNull()!, context);
    }
}
