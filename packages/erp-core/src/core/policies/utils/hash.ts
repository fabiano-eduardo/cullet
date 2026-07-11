import { sha256Hex } from "../../shared/hashing.js";
import { canonicalStringify } from "../../shared/stable-stringify.js";

/**
 * Produces a deterministic SHA-256 hex digest of a canonical JSON representation.
 * Object keys are sorted recursively so key order does not affect the hash.
 * Array item order is preserved on purpose; callers that treat arrays as sets
 * must normalize or sort them before hashing.
 *
 * The strict canonical form is owned by `shared/stable-stringify`
 * ({@link canonicalStringify}); this class just composes it with SHA-256.
 * Values that JSON.stringify would silently drop or coerce (undefined,
 * non-finite numbers, functions, symbols, bigint) are rejected up-front to
 * prevent semantically different payloads from collapsing to the same hash.
 */
export class PolicyHashing {
    static sha256(input: string): string {
        return sha256Hex(input);
    }

    static canonicalJson(value: unknown): string {
        return canonicalStringify(value);
    }

    static computePayloadHash(
        payload: unknown,
        policyKey: string,
        policyVersion: string,
    ): string {
        const canonical = PolicyHashing.canonicalJson({
            policyKey,
            policyVersion,
            payload,
        });

        return PolicyHashing.sha256(canonical);
    }
}
