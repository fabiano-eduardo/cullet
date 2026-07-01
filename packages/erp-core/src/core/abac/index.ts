// Barrel for the zod-free ABAC module: the pure rule/policy-set primitives, the
// combining algorithms, the attribute→context flattening, the pure decisor, the
// optional RBAC+ABAC composite, and the AbacAuthorizerPort seam (which physically
// lives under application/ports/ but is surfaced here as the ABAC public home).

export type { AbacAuthorizerPort } from "../application/ports/abac-authorizer.port.js";

export type { AbacAttributes, AbacRequest } from "./abac-request.js";
export { abacContext } from "./attributes.js";
export { AbacAuthorizer, type AbacDecision } from "./authorizer.js";
export type { CombiningAlgorithm } from "./combining.js";
export {
    type CompositeAccessRequest,
    CompositeAuthorizer,
} from "./composite-authorizer.js";
export { AbacPolicySet } from "./domain/policy-set.js";
export {
    AbacRule,
    type AbacRuleProps,
    type RuleEffect,
} from "./domain/rule.js";
