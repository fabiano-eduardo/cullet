import type { Result as ResultType } from "../../result/result";
import { Result } from "../../result/result";

import type { ComputePayload } from "./compute-payload";
import { ComputePayloadSchemaV1 } from "./v1/compute/compute-payload.schema";

export type ComputePayloadParser = (
  payload: unknown,
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
        `No compute payload parser registered for schema version "${payloadSchemaVersion}"`,
      );
    }

    return parser(payload);
  }
}

export class ComputePayloadParsers {
  private static readonly registry = new ComputePayloadParserRegistry();
  private static defaultsRegistered = false;

  // Registers the built-in v1 parser lazily, the first time the default
  // dispatcher is touched. Done here — rather than as a top-level module
  // statement — so the package's `"sideEffects": false` flag stays honest and
  // a tree-shaking bundler cannot drop the v1 registration and leave the
  // compute engine unable to parse v1 payloads at runtime.
  private static ensureDefaults(): void {
    if (ComputePayloadParsers.defaultsRegistered) {
      return;
    }
    ComputePayloadParsers.defaultsRegistered = true;
    ComputePayloadParsers.registry.register(1, ComputePayloadSchemaV1.parse);
  }

  static register(
    payloadSchemaVersion: number,
    parser: ComputePayloadParser,
  ): void {
    ComputePayloadParsers.ensureDefaults();
    ComputePayloadParsers.registry.register(payloadSchemaVersion, parser);
  }

  static get(payloadSchemaVersion: number): ComputePayloadParser | undefined {
    ComputePayloadParsers.ensureDefaults();
    return ComputePayloadParsers.registry.get(payloadSchemaVersion);
  }

  static parse(payloadSchemaVersion: number, payload: unknown) {
    ComputePayloadParsers.ensureDefaults();
    return ComputePayloadParsers.registry.parse(payloadSchemaVersion, payload);
  }
}

export type { ComputePayload };
