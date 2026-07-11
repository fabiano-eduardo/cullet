export { Entity, type EntityState } from "../core/domain/entity.js";
export { UuidIdentifier } from "../core/domain/uuid-identifier.js";
export {
    type DeepReadonly,
    ValueObject,
    type ValueObjectPluginContract,
} from "../core/domain/value-object.js";
// Bitemporal primitives. Published on this subpath (not the root barrel)
// because the public `TemporalRepository` port already exposes
// `TemporalSnapshot` — implementers need the validating factories that build
// it, not just the type.
export * from "../core/domain/temporal/index.js";
