import type {
	ComputePayload,
	GatePayload,
} from '../engines';

export type AnyPolicyPayload = GatePayload | ComputePayload;

/**
 * Payload type associated with a policy key.
 *
 * Intentionally NOT backed by global module augmentation: two modules registering
 * different shapes for the same literal key would silently override each other and
 * the last `declare module` wins. Per-key payload typing must be expressed
 * explicitly at the definition site (see {@link PolicyDefinition} type params).
 */
export type PayloadForKey<_K extends string> = AnyPolicyPayload;
