import { type CoreConfig, coreConfig } from "../config/index.js";
import { AuthorizationError } from "../errors/authorization-error.js";
import { ConditionEvaluatorV1 } from "../policies/engines/v1/condition-evaluator.js";
import { Result } from "../result/result.js";

import type { AbacRequest } from "./abac-request.js";
import { abacContext } from "./attributes.js";
import {
    combine,
    type CombineResult,
    type CombiningAlgorithm,
} from "./combining.js";
import type { AbacPolicySet } from "./domain/policy-set.js";
import type { AbacRule } from "./domain/rule.js";

// ABAC reuses the gate engine's v1 condition matcher; the version stamps the
// evaluation reports the shared reporter emits.
const ENGINE_VERSION = 1;

/** The successful decision returned by {@link AbacAuthorizer.authorize}. */
interface AbacDecision {
    /** The audited business action that was allowed. */
    readonly action: string;
    readonly effect: "PERMIT";
    /** The id of the rule that permitted, or `"<default>"` when the set's default did. */
    readonly matchedRule: string;
    readonly algorithm: CombiningAlgorithm;
    /** When the decision was made, ISO-8601. */
    readonly grantedAtIso: string;
}

/**
 * The pure ABAC decisor. Given an {@link AbacRequest} and an
 * {@link AbacPolicySet}, it flattens the request's attributes into a context,
 * matches each rule's condition with the gate engine's pure condition evaluator
 * (reused, not reimplemented), resolves the effects through the set's combining
 * algorithm, and returns a {@link Result} — never throwing, mirroring the
 * "errors as values" contract of `RbacAuthorizer`/`GateEngineV1`.
 *
 * A denial maps to {@link AuthorizationError.policyDenied}, attributed to the
 * deciding rule's `id`/`version`; a condition-evaluation failure (a missing
 * attribute, a wrong-typed operand) fails closed as
 * {@link AuthorizationError.forbidden}. Under `deny-overrides` /
 * `permit-overrides` every rule's condition is evaluated, so a single
 * non-evaluable rule fails the whole decision closed — adding a rule that
 * references an attribute a call site does not provide turns that call site
 * into a 403 until the attribute is supplied. Under `first-applicable`, rules
 * are evaluated in order and evaluation stops at the first applicable one
 * (XACML semantics): rules after it — evaluable or not — never influence the
 * decision. Loading the dynamic attributes is the consumer's job (behind an
 * `AbacAuthorizerPort` adapter); this class only decides.
 */
class AbacAuthorizer {
    private readonly coreConfig: CoreConfig;

    constructor(params: { readonly coreConfig?: CoreConfig } = {}) {
        this.coreConfig = params.coreConfig ?? coreConfig;
    }

    authorize(
        request: AbacRequest,
        policies: AbacPolicySet,
    ): Result<AbacDecision, AuthorizationError> {
        const context = abacContext(request);
        const evaluator = new ConditionEvaluatorV1(
            context,
            this.coreConfig.getConditionEvaluationOptions(ENGINE_VERSION),
        );

        // Fail closed: a technical evaluation error is never a silent PERMIT.
        const failClosed = (details: string | undefined) =>
            Result.err(
                AuthorizationError.forbidden({
                    action: request.action,
                    resource: request.resource,
                    actor: { userId: request.actor.raw },
                    details,
                }),
            );

        let combined: CombineResult;
        if (policies.algorithm === "first-applicable") {
            // Evaluate in order and stop at the first applicable rule (XACML
            // first-applicable): later rules never run, so a non-evaluable rule
            // after the deciding one cannot fail the decision.
            combined = { effect: policies.defaultEffect };
            for (const rule of policies.rules) {
                const matched = evaluator.evaluate(rule.condition);
                if (matched.isErr()) {
                    return failClosed(matched.errorOrNull() ?? undefined);
                }
                if (matched.getOrThrow()) {
                    combined = { effect: rule.effect, decidingRule: rule };
                    break;
                }
            }
        } else {
            // deny-/permit-overrides: an applicable rule anywhere in the set can
            // decide, so every condition must evaluate.
            const applicable: AbacRule[] = [];
            for (const rule of policies.rules) {
                const matched = evaluator.evaluate(rule.condition);
                if (matched.isErr()) {
                    return failClosed(matched.errorOrNull() ?? undefined);
                }
                if (matched.getOrThrow()) {
                    applicable.push(rule);
                }
            }
            combined = combine(
                policies.algorithm,
                applicable,
                policies.defaultEffect,
            );
        }

        const { effect, decidingRule } = combined;

        if (effect === "PERMIT") {
            return Result.ok({
                action: request.action,
                effect: "PERMIT",
                matchedRule: decidingRule?.id ?? "<default>",
                algorithm: policies.algorithm,
                grantedAtIso: new Date().toISOString(),
            });
        }

        return Result.err(
            AuthorizationError.policyDenied({
                policyId: decidingRule?.id ?? "<default-deny>",
                policyVersion: decidingRule?.version ?? 0,
                evaluatedAtIso: new Date().toISOString(),
                action: request.action,
                resource: request.resource,
                actor: { userId: request.actor.raw },
                reasonCode: decidingRule?.id,
            }),
        );
    }
}

export { AbacAuthorizer, type AbacDecision };
