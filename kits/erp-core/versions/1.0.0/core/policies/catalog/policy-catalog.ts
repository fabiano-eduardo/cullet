import { UnexpectedError } from "../../errors";
import { Result } from "../../result/result";

import { PolicyCatalogEntry } from "./policy-catalog-entry";

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

  getFamily(key: string): Result<readonly PolicyCatalogEntry[], string> {
    const family = this.entriesByKey.get(key);
    if (!family) {
      return Result.err(`Policy not found in catalog: "${key}"`);
    }

    return Result.ok(family);
  }

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

  list(): readonly PolicyCatalogEntry[] {
    return Array.from(this.versionedEntries.values());
  }

  has(key: string): boolean {
    return this.entriesByKey.has(key);
  }
}
