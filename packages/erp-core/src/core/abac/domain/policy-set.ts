import type { CombiningAlgorithm } from "../combining.js";

import type { AbacRule, RuleEffect } from "./rule.js";

/**
 * An ordered collection of {@link AbacRule}s plus how to combine them
 * ({@link CombiningAlgorithm}) and what to decide when no rule applies
 * ({@link defaultEffect}). This is where ABAC goes beyond a single gate
 * condition: several PERMIT/DENY rules resolved by an explicit algorithm.
 *
 * Closed by default — the combining algorithm defaults to `"deny-overrides"` and
 * the default effect to `"DENY"`, so a request matching nothing is denied. A
 * plain holder (not a value object); build through {@link of}.
 */
class AbacPolicySet {
    private constructor(
        private readonly _rules: readonly AbacRule[],
        private readonly _algorithm: CombiningAlgorithm,
        private readonly _defaultEffect: RuleEffect,
    ) {
        Object.freeze(this._rules);
        Object.freeze(this);
    }

    static of(
        rules: readonly AbacRule[],
        options: {
            readonly algorithm?: CombiningAlgorithm;
            readonly defaultEffect?: RuleEffect;
        } = {},
    ): AbacPolicySet {
        return new AbacPolicySet(
            [...rules],
            options.algorithm ?? "deny-overrides",
            options.defaultEffect ?? "DENY",
        );
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
}

export { AbacPolicySet };
