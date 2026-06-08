import { sha256Hex, stableStringify } from "../../shared/hashing";
import { isValidDate } from "../../shared/temporal-guards";

/**
 * Produces a deterministic SHA-256 hex digest of a canonical JSON representation.
 * Object keys are sorted recursively so key order does not affect the hash.
 * Array item order is preserved on purpose; callers that treat arrays as sets
 * must normalize or sort them before hashing.
 *
 * Values that JSON.stringify would silently drop or coerce (undefined,
 * non-finite numbers, functions, symbols, bigint) are rejected up-front to
 * prevent semantically different payloads from collapsing to the same hash.
 */
export class PolicyHashing {
    static sha256(input: string): string {
        return sha256Hex(input);
    }

    private static assertHashable(value: unknown, path: string): void {
        if (value === null) {
            return;
        }

        const type = typeof value;

        if (type === "undefined") {
            throw new TypeError(
                `canonicalJson does not accept undefined values (at ${path})`,
            );
        }

        if (type === "number" && !Number.isFinite(value)) {
            throw new TypeError(
                `canonicalJson does not accept non-finite numbers (at ${path}, value: ${String(value)})`,
            );
        }

        if (type === "bigint" || type === "function" || type === "symbol") {
            throw new TypeError(
                `canonicalJson does not accept ${type} values (at ${path})`,
            );
        }

        if (type !== "object") {
            return;
        }

        if (value instanceof Date) {
            if (!isValidDate(value)) {
                throw new TypeError(
                    `canonicalJson does not accept Invalid Date (at ${path})`,
                );
            }
            return;
        }

        if (Array.isArray(value)) {
            value.forEach((item, index) => {
                PolicyHashing.assertHashable(item, `${path}[${index}]`);
            });
            return;
        }

        for (const [key, nested] of Object.entries(
            value as Record<string, unknown>,
        )) {
            PolicyHashing.assertHashable(nested, `${path}.${key}`);
        }
    }

    static canonicalJson(value: unknown): string {
        PolicyHashing.assertHashable(value, "$");

        return stableStringify(value);
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
