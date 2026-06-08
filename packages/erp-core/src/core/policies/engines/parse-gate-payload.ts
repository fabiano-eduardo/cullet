import type { Result as ResultType } from "../../result/result";
import { Result } from "../../result/result";

import type { GatePayload } from "./gate-payload";
import { GatePayloadSchemaV1 } from "./v1/gate/gate-v1-payload.schema";

export type GatePayloadParser = (
    payload: unknown,
) => ResultType<GatePayload, string>;

export class GatePayloadParserRegistry {
    private readonly parsers = new Map<number, GatePayloadParser>();

    register(engineVersion: number, parser: GatePayloadParser): void {
        this.parsers.set(engineVersion, parser);
    }

    get(engineVersion: number): GatePayloadParser | undefined {
        return this.parsers.get(engineVersion);
    }

    parse(engineVersion: number, payload: unknown) {
        const parser = this.parsers.get(engineVersion);

        if (parser === undefined) {
            return Result.err(
                `No gate payload parser registered for engine version "${engineVersion}"`,
            );
        }

        return parser(payload);
    }
}

export class GatePayloadParsers {
    private static readonly registry = new GatePayloadParserRegistry();
    private static defaultsRegistered = false;

    // Registers the built-in v1 parser lazily, the first time the default
    // dispatcher is touched. Done here — rather than as a top-level module
    // statement — so the package's `"sideEffects": false` flag stays honest and
    // a tree-shaking bundler cannot drop the v1 registration and leave the gate
    // engine unable to parse v1 payloads at runtime.
    private static ensureDefaults(): void {
        if (GatePayloadParsers.defaultsRegistered) {
            return;
        }
        GatePayloadParsers.defaultsRegistered = true;
        GatePayloadParsers.registry.register(1, GatePayloadSchemaV1.parse);
    }

    static register(engineVersion: number, parser: GatePayloadParser): void {
        GatePayloadParsers.ensureDefaults();
        GatePayloadParsers.registry.register(engineVersion, parser);
    }

    static get(engineVersion: number): GatePayloadParser | undefined {
        GatePayloadParsers.ensureDefaults();
        return GatePayloadParsers.registry.get(engineVersion);
    }

    static parse(engineVersion: number, payload: unknown) {
        GatePayloadParsers.ensureDefaults();
        return GatePayloadParsers.registry.parse(engineVersion, payload);
    }
}

export type { GatePayload };
