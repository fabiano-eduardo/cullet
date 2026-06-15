import type { PolicyPackage } from "../package/policy-package.js";

import { PolicyCatalog } from "./policy-catalog.js";
import { PolicyCatalogEntry } from "./policy-catalog-entry.js";

// ─── Factory ────────────────────────────────────────────────────────────────

/**
 * Aggregates catalog entries contributed by each module package into a single
 * PolicyCatalog. The core knows nothing about concrete modules — callers
 * are responsible for passing all relevant packages at composition time.
 */
export class PolicyCatalogFactory {
    static build(packages: readonly PolicyPackage[]): PolicyCatalog {
        const entries = packages.flatMap((policyPackage) =>
            Array.from(policyPackage.catalogEntries).map(
                PolicyCatalogEntry.from,
            ),
        );

        return new PolicyCatalog(entries);
    }
}
