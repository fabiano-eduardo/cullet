import type { AbacRule, RuleEffect } from "./domain/rule.js";

/**
 * How an {@link AbacPolicySet} resolves several applicable rules into one effect.
 *
 * - `deny-overrides` (default, secure): any applicable DENY wins; otherwise the
 *   first PERMIT; otherwise the set's default effect.
 * - `permit-overrides`: any applicable PERMIT wins; otherwise the first DENY;
 *   otherwise the default effect.
 * - `first-applicable`: the effect of the first rule that matches; otherwise the
 *   default effect.
 */
export type CombiningAlgorithm =
    | "deny-overrides"
    | "permit-overrides"
    | "first-applicable";

/** The resolved decision plus the rule (if any) that produced it. */
export interface CombineResult {
    readonly effect: RuleEffect;
    readonly decidingRule?: AbacRule;
}

function firstWithEffect(
    rules: readonly AbacRule[],
    effect: RuleEffect,
): AbacRule | undefined {
    return rules.find((rule) => rule.effect === effect);
}

/**
 * Applies `algorithm` to the already-matched `applicable` rules, falling back to
 * `defaultEffect` when the algorithm reaches no rule-backed decision. Pure and
 * total; the returned `decidingRule` is absent exactly when `defaultEffect` was
 * used.
 */
export function combine(
    algorithm: CombiningAlgorithm,
    applicable: readonly AbacRule[],
    defaultEffect: RuleEffect,
): CombineResult {
    switch (algorithm) {
        case "deny-overrides": {
            const deny = firstWithEffect(applicable, "DENY");
            if (deny) return { effect: "DENY", decidingRule: deny };
            const permit = firstWithEffect(applicable, "PERMIT");
            if (permit) return { effect: "PERMIT", decidingRule: permit };
            return { effect: defaultEffect };
        }
        case "permit-overrides": {
            const permit = firstWithEffect(applicable, "PERMIT");
            if (permit) return { effect: "PERMIT", decidingRule: permit };
            const deny = firstWithEffect(applicable, "DENY");
            if (deny) return { effect: "DENY", decidingRule: deny };
            return { effect: defaultEffect };
        }
        case "first-applicable": {
            const first = applicable[0];
            if (first) return { effect: first.effect, decidingRule: first };
            return { effect: defaultEffect };
        }
    }
}
