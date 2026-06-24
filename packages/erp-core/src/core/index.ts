export * from "./errors/index.js";
export * from "./exceptions/index.js";
export * from "./application/index.js";
export { Entity, type EntityState } from "./domain/entity.js";
export {
    ValueObject,
    type DeepReadonly,
    type ValueObjectPluginContract,
} from "./domain/value-object.js";
export * from "./domain/rulesets/index.js";
export * from "./plugins/index.js";
export * from "./versioning/index.js";
// NOTE: `./policies` re-exports Result/Ok/Err/Outcome/CommonOutcomeStatus and
// transitively pulls in `zod` (the gate/compute engines). Consumers that only
// need the zod-free primitives should import the dedicated subpaths
// (`@cullet/erp-core/{domain,result,exceptions,rulesets,versioning,plugins}`).
export * from "./policies/index.js";
