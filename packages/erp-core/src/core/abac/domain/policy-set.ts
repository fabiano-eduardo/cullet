import { ValidationCode } from "../../exceptions/validation-code.js";
import { InvalidValueException } from "../../exceptions/validation-exception.js";
import { ValidationField } from "../../exceptions/validation-field.js";
import type { CombiningAlgorithm } from "../combining.js";

import type { AbacRule, RuleEffect } from "./rule.js";

/**
 * How the {@link AbacAuthorizer} reacts when a rule's condition cannot be
 * evaluated (a referenced attribute is absent, an operand is wrong-typed).
 *
 * - `fail-closed` (default, secure): the whole decision fails closed as
 *   `forbidden`. Safe, but it means adding a rule that reads an attribute a call
 *   site does not populate makes that call site deny everything until it does.
 * - `skip-rule`: the unevaluable rule is dropped from the applicable set and the
 *   remaining rules decide — the escape valve for evolving rules without
 *   trailing every call site. The evaluator still reports the anomaly.
 */
export type OnEvaluationError = "fail-closed" | "skip-rule";

const POLICY_SET_FIELD = ValidationField.of("abacPolicySet");

/**
 * An ordered collection of {@link AbacRule}s plus how to combine them
 * ({@link CombiningAlgorithm}), what to decide when no rule applies
 * ({@link defaultEffect}), and how to react to an unevaluable rule
 * ({@link onEvaluationError}). This is where ABAC goes beyond a single gate
 * condition: several PERMIT/DENY rules resolved by an explicit algorithm.
 *
 * Closed by default — the combining algorithm defaults to `"deny-overrides"`,
 * the default effect to `"DENY"`, and evaluation errors to `"fail-closed"`, so a
 * request matching nothing (or hitting a technical error) is denied. A plain
 * holder (not a value object); build through {@link of}.
 */
class AbacPolicySet {
    private constructor(
        private readonly _rules: readonly AbacRule[],
        private readonly _algorithm: CombiningAlgorithm,
        private readonly _defaultEffect: RuleEffect,
        private readonly _onEvaluationError: OnEvaluationError,
    ) {
        Object.freeze(this._rules);
        Object.freeze(this);
    }

    /**
     * Builds a policy set. Rejects duplicate rule ids with
     * {@link InvalidValueException} so a denial's `policyId` attribution is
     * unambiguous.
     */
    static of(
        rules: readonly AbacRule[],
        options: {
            readonly algorithm?: CombiningAlgorithm;
            readonly defaultEffect?: RuleEffect;
            readonly onEvaluationError?: OnEvaluationError;
        } = {},
    ): AbacPolicySet {
        AbacPolicySet.assertUniqueIds(rules);
        return new AbacPolicySet(
            [...rules],
            options.algorithm ?? "deny-overrides",
            options.defaultEffect ?? "DENY",
            options.onEvaluationError ?? "fail-closed",
        );
    }

    private static assertUniqueIds(rules: readonly AbacRule[]): void {
        const seen = new Set<string>();
        for (const rule of rules) {
            if (seen.has(rule.id)) {
                throw new InvalidValueException(
                    POLICY_SET_FIELD.nested("rules"),
                    ValidationCode.ALREADY_EXISTS,
                    `abac policy set has duplicate rule id "${rule.id}"; ids must be unique for unambiguous audit attribution`,
                );
            }
            seen.add(rule.id);
        }
    }

    get rules(): readonly AbacRule[] {
        return this._rules;
    }

    get algorithm(): CombiningAlgorithm {
        return this._algorithm;
    }

    get defaultEffect(): RuleEffect {
        return this._defaultEffect;
    }

    get onEvaluationError(): OnEvaluationError {
        return this._onEvaluationError;
    }
}

export { AbacPolicySet };
