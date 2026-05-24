import type { Result as ResultType } from '../../result/result';
import { Result } from '../../result/result';

import type { ComputePayload } from './compute-payload';
import { ComputePayloadSchemaV1 } from './v1/compute/compute-payload.schema';

export type ComputePayloadParser = (
	payload: unknown
) => ResultType<ComputePayload, string>;

export class ComputePayloadParserRegistry {
	private readonly parsers = new Map<number, ComputePayloadParser>();

	register(payloadSchemaVersion: number, parser: ComputePayloadParser): void {
		this.parsers.set(payloadSchemaVersion, parser);
	}

	get(payloadSchemaVersion: number): ComputePayloadParser | undefined {
		return this.parsers.get(payloadSchemaVersion);
	}

	parse(payloadSchemaVersion: number, payload: unknown) {
		const parser = this.parsers.get(payloadSchemaVersion);

		if (parser === undefined) {
			return Result.err(
				`No compute payload parser registered for schema version "${payloadSchemaVersion}"`
			);
		}

		return parser(payload);
	}
}

export class ComputePayloadParsers {
	private static readonly registry = new ComputePayloadParserRegistry();

	static register(
		payloadSchemaVersion: number,
		parser: ComputePayloadParser
	): void {
		ComputePayloadParsers.registry.register(payloadSchemaVersion, parser);
	}

	static get(payloadSchemaVersion: number): ComputePayloadParser | undefined {
		return ComputePayloadParsers.registry.get(payloadSchemaVersion);
	}

	static parse(payloadSchemaVersion: number, payload: unknown) {
		return ComputePayloadParsers.registry.parse(
			payloadSchemaVersion,
			payload
		);
	}
}

ComputePayloadParsers.register(1, ComputePayloadSchemaV1.parse);

export type { ComputePayload };
