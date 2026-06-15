import type { PolicyCatalogEntryProps } from "../catalog/index.js";
import type { PolicyDefinition } from "../defs/index.js";
import type { ComputeEvaluatorRegistration } from "../engines/index.js";

/**
 * Protocol of contribution: a module declares what it wants to add to the
 * policy system without the core knowing which module it is.
 *
 * - catalogEntries: static policy descriptors the catalog will register.
 * - definitions:   default policy definitions (rules/parameters) to seed.
 * - evaluators:    compute evaluator registrations keyed by policy/version.
 */
export interface PolicyPackage {
    readonly catalogEntries: readonly PolicyCatalogEntryProps[];
    readonly definitions: readonly PolicyDefinition[];
    readonly evaluators: readonly ComputeEvaluatorRegistration[];
}
