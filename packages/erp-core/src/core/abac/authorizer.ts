import { type CoreConfig, coreConfig } from "../config/index.js";
import { AuthorizationError } from "../errors/authorization-error.js";
import { ConditionEvaluatorV1 } from "../policies/engines/v1/condition-evaluator.js";
import { Result } from "../result/result.js";

import type { AbacRequest } from "./abac-request.js";
import { abacContext } from "./attributes.js";
import { combine, type CombiningAlgorithm } from "./combining.js";
import type { AbacPolicySet } from "./domain/policy-set.js";
import type { AbacRule, RuleEffect } from "./domain/rule.js";

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
 * deciding rule's `id`/`version`. A condition-evaluation failure (a missing
 * attribute, a wrong-typed operand) fails closed as
 * {@link AuthorizationError.forbidden} — also attributed to the culprit rule's
 * `id`/`version` — unless the set opts into `onEvaluationError: "skip-rule"`, in
 * which case the unevaluable rule is skipped and the rest decide. Every resolved
 * decision (PERMIT and DENY) is emitted best-effort through the configured
 * reporter as an `abac-decision` event (silent by default). Timestamps come from
 * an injectable `clock` (default `() => new Date()`), so the decisor is pure
 * given one. Loading the dynamic attributes is the consumer's job (behind an
 * `AbacAuthorizerPort` adapter); this class only decides.
 */
class AbacAuthorizer {
    private readonly coreConfig: CoreConfig;
    private readonly clock: () => Date;

    constructor(
        params: {
            readonly coreConfig?: CoreConfig;
            /** Injectable clock for deterministic timestamps; defaults to `() => new Date()`. */
            readonly clock?: () => Date;
        } = {},
    ) {
        this.coreConfig = params.coreConfig ?? coreConfig;
        this.clock = params.clock ?? (() => new Date());
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

        const applicable: AbacRule[] = [];
        for (const rule of policies.rules) {
            const matched = evaluator.evaluate(rule.condition);
            if (matched.isErr()) {
                if (policies.onEvaluationError === "skip-rule") {
                    // Escape valve for evolving rules: drop the unevaluable rule
                    // (the evaluator already reported the anomaly) and let the
                    // rest decide, instead of failing the whole set closed.
                    continue;
                }
                // Fail closed: a technical evaluation error is never a silent
                // PERMIT. Attribute the deny to the culprit rule so the 403 is
                // triageable without turning on the reporter.
                return Result.err(
                    AuthorizationError.forbidden({
                        action: request.action,
                        resource: request.resource,
                        actor: { actorId: request.actor.raw },
                        policyId: rule.id,
                        policyVersion: rule.version,
                        details: matched.errorOrNull() ?? undefined,
                    }),
                );
            }
            if (matched.getOrThrow()) {
                applicable.push(rule);
            }
        }

        const { effect, decidingRule } = combine(
            policies.algorithm,
            applicable,
            policies.defaultEffect,
        );

        this.reportDecision(request, policies, effect, decidingRule);

        if (effect === "PERMIT") {
            return Result.ok({
                action: request.action,
                effect: "PERMIT",
                matchedRule: decidingRule?.id ?? "<default>",
                algorithm: policies.algorithm,
                grantedAtIso: this.clock().toISOString(),
            });
        }

        return Result.err(
            AuthorizationError.policyDenied({
                policyId: decidingRule?.id ?? "<default-deny>",
                policyVersion: decidingRule?.version ?? 0,
                evaluatedAtIso: this.clock().toISOString(),
                action: request.action,
                resource: request.resource,
                actor: { actorId: request.actor.raw },
                reasonCode: decidingRule?.id,
            }),
        );
    }

    // Best-effort audit trail: emits the resolved decision (PERMIT and DENY)
    // through the configured reporter, silent by default.
    private reportDecision(
        request: AbacRequest,
        policies: AbacPolicySet,
        effect: RuleEffect,
        decidingRule: AbacRule | undefined,
    ): void {
        this.coreConfig.reportSafely({
            kind: "abac-decision",
            level: "info",
            action: request.action,
            resource: request.resource,
            actorId: request.actor.raw,
            effect,
            decidingRuleId:
                decidingRule?.id ??
                (effect === "PERMIT" ? "<default>" : "<default-deny>"),
            decidingRuleVersion: decidingRule?.version,
            algorithm: policies.algorithm,
            occurredAt: this.clock(),
        });
    }
}

export { AbacAuthorizer, type AbacDecision };
