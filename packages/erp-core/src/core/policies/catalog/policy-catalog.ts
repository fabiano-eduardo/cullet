import { UnexpectedError } from "../../errors/index.js";
import { Result } from "../../result/result.js";

import { PolicyCatalogEntry } from "./policy-catalog-entry.js";

/**
 * In-code catalog of all known policies.
 * The catalog defines the universe of policies; the database cannot invent new ones.
 */
export class PolicyCatalog {
    private readonly versionedEntries: ReadonlyMap<string, PolicyCatalogEntry>;
    private readonly entriesByKey: ReadonlyMap<
        string,
        readonly PolicyCatalogEntry[]
    >;

    /**
     * Indexes the given entries up front into two lookups — one per exact
     * variant, one per policy key (the "family") — and validates them eagerly:
     * a duplicate variant or an internally inconsistent family throws here, at
     * wiring time, so a malformed catalog fails fast at startup rather than on
     * the first evaluation.
     *
     * @throws {UnexpectedError} When two entries resolve to the same variant key.
     */
    constructor(entries: readonly PolicyCatalogEntry[]) {
        const families = new Map<string, PolicyCatalogEntry[]>();
        const versionedMap = new Map<string, PolicyCatalogEntry>();

        for (const rawEntry of entries) {
            const entry = PolicyCatalogEntry.from(rawEntry);
            const key = entry.key.toString();
            const variantKey = entry.toVariantKey();

            if (versionedMap.has(variantKey)) {
                throw new UnexpectedError(
                    `Duplicate PolicyCatalog entry for key "${key}" and variant "${variantKey}"`,
                );
            }

            const family = families.get(key) ?? [];
            family.push(entry);
            families.set(key, family);
            versionedMap.set(variantKey, entry);
        }

        for (const family of families.values()) {
            PolicyCatalogEntry.assertFamilyConsistency(family);
        }

        this.versionedEntries = versionedMap;
        this.entriesByKey = families;
    }

    /**
     * Returns the single entry for a key. Deliberately strict: if the key has
     * more than one variant it errs rather than guessing, steering the caller to
     * {@link getVersioned} or {@link getFamily}. Use this only when a key is
     * known to be unambiguous.
     *
     * @returns `ok` with the entry, or `err` when the key is unknown or ambiguous.
     */
    get(key: string): Result<PolicyCatalogEntry, string> {
        const familyResult = this.getFamily(key);
        if (familyResult.isErr()) {
            return Result.err(familyResult.errorOrNull()!);
        }

        const family = familyResult.getOrNull()!;
        if (family.length > 1) {
            return Result.err(
                `Policy key "${key}" has multiple catalog variants; use getVersioned(...) or getFamily(...)`,
            );
        }

        const [entry] = family;
        if (!entry) {
            return Result.err(`Policy not found in catalog: "${key}"`);
        }

        return Result.ok(entry);
    }

    /**
     * Returns every variant registered under a key — the whole "family". This is
     * the lookup the evaluation pipeline uses, since a single key may host
     * several engine/schema variants that the resolver then chooses between.
     *
     * @returns `ok` with the family (always non-empty), or `err` when the key is unknown.
     */
    getFamily(key: string): Result<readonly PolicyCatalogEntry[], string> {
        const family = this.entriesByKey.get(key);
        if (!family) {
            return Result.err(`Policy not found in catalog: "${key}"`);
        }

        return Result.ok(family);
    }

    /**
     * Resolves the one entry matching an exact variant — kind plus engine and
     * payload-schema versions. Falls back to the sole family member when a key
     * has exactly one entry and that entry declares no explicit version
     * selector, so unversioned single-variant policies "just work" without the
     * caller spelling out versions.
     *
     * @param params - The key and the variant coordinates to match on.
     * @returns `ok` with the matching entry, or `err` when no variant matches.
     */
    getVersioned(params: {
        readonly key: string;
        readonly kind: "GATE" | "COMPUTE";
        readonly gateEngineVersion?: number;
        readonly computeEngineVersion?: number;
        readonly payloadSchemaVersion?: number;
    }): Result<PolicyCatalogEntry, string> {
        const family = this.entriesByKey.get(params.key);
        if (!family || family.length === 0) {
            return Result.err(`Policy not found in catalog: "${params.key}"`);
        }

        const exactMatch = family.find((entry) => entry.matchesVersion(params));
        if (exactMatch) {
            return Result.ok(exactMatch);
        }

        if (family.length === 1 && !family[0].hasExplicitVersionSelector()) {
            return Result.ok(family[0]);
        }

        const versionDetails = [
            params.kind,
            params.gateEngineVersion !== undefined
                ? `gateEngineVersion=${params.gateEngineVersion}`
                : null,
            params.computeEngineVersion !== undefined
                ? `computeEngineVersion=${params.computeEngineVersion}`
                : null,
            params.payloadSchemaVersion !== undefined
                ? `payloadSchemaVersion=${params.payloadSchemaVersion}`
                : null,
        ]
            .filter((part): part is string => part !== null)
            .join(", ");

        return Result.err(
            `Policy variant not found in catalog: "${params.key}" (${versionDetails})`,
        );
    }

    /** Lists every registered variant across all keys — useful for introspection and diagnostics. */
    list(): readonly PolicyCatalogEntry[] {
        return Array.from(this.versionedEntries.values());
    }

    /** Returns whether any variant is registered under the given key. */
    has(key: string): boolean {
        return this.entriesByKey.has(key);
    }
}
