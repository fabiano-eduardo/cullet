import type { Result as ResultType } from '../../result/result';
import { Result } from '../../result/result';

import type { GatePayload } from './gate-payload';
import { GatePayloadSchemaV1 } from './v1/gate/gate-v1-payload.schema';

export type GatePayloadParser = (
	payload: unknown
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
				`No gate payload parser registered for engine version "${engineVersion}"`
			);
		}

		return parser(payload);
	}
}

export class GatePayloadParsers {
	private static readonly registry = new GatePayloadParserRegistry();

	static register(engineVersion: number, parser: GatePayloadParser): void {
		GatePayloadParsers.registry.register(engineVersion, parser);
	}

	static get(engineVersion: number): GatePayloadParser | undefined {
		return GatePayloadParsers.registry.get(engineVersion);
	}

	static parse(engineVersion: number, payload: unknown) {
		return GatePayloadParsers.registry.parse(engineVersion, payload);
	}
}

GatePayloadParsers.register(1, GatePayloadSchemaV1.parse);

export type { GatePayload };
