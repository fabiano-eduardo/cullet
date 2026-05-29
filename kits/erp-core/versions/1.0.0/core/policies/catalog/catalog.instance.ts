import type { PolicyPackage } from "../package/policy-package";

import { PolicyCatalog } from "./policy-catalog";
import { PolicyCatalogEntry } from "./policy-catalog-entry";

// ─── Factory ────────────────────────────────────────────────────────────────

/**
 * Aggregates catalog entries contributed by each module package into a single
 * PolicyCatalog. The core knows nothing about concrete modules — callers
 * are responsible for passing all relevant packages at composition time.
 */
export class PolicyCatalogFactory {
  static build(packages: readonly PolicyPackage[]): PolicyCatalog {
    const entries = packages.flatMap((policyPackage) =>
      Array.from(policyPackage.catalogEntries).map(PolicyCatalogEntry.from),
    );

    return new PolicyCatalog(entries);
  }
}
