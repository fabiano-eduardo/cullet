// Barrel for the zod-free ABAC module: the pure rule/policy-set primitives, the
// combining algorithms, the attribute→context flattening, the pure decisor, the
// optional RBAC+ABAC composite, and the AbacAuthorizerPort seam (which physically
// lives under application/ports/ but is surfaced here as the ABAC public home).
//
// Rule-author footguns (documented in full on AbacRule): a referenced attribute
// absent from the request is a technical error that, by default, fails the whole
// decision closed — set `onEvaluationError: "skip-rule"` on the AbacPolicySet to
// skip the unevaluable rule instead. `isNull`/`isNotNull` match an explicit
// `null` value, never a missing key.

export type { AbacAuthorizerPort } from "../application/ports/abac-authorizer.port.js";

export type { AbacAttributes, AbacRequest } from "./abac-request.js";
export { abacContext } from "./attributes.js";
export { AbacAuthorizer, type AbacDecision } from "./authorizer.js";
export type { CombiningAlgorithm } from "./combining.js";
export {
    type CompositeAccessRequest,
    CompositeAuthorizer,
} from "./composite-authorizer.js";
export { AbacPolicySet, type OnEvaluationError } from "./domain/policy-set.js";
export {
    AbacRule,
    type AbacRuleProps,
    type RuleEffect,
} from "./domain/rule.js";
