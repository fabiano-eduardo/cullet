import { describe, expect, it } from "vitest";

import { InvalidValueException } from "../../exceptions/validation-exception.js";

import { AbacPolicySet } from "./policy-set.js";
import { AbacRule } from "./rule.js";

const rule = AbacRule.of({
    id: "r",
    version: 1,
    effect: "PERMIT",
    condition: { field: "resource.status", op: "eq", value: "OPEN" },
});

describe("AbacPolicySet", () => {
    it("closes by default: deny-overrides + DENY + fail-closed", () => {
        const set = AbacPolicySet.of([rule]);

        expect(set.algorithm).toBe("deny-overrides");
        expect(set.defaultEffect).toBe("DENY");
        expect(set.onEvaluationError).toBe("fail-closed");
        expect(set.rules).toEqual([rule]);
    });

    it("honours explicit options", () => {
        const set = AbacPolicySet.of([rule], {
            algorithm: "permit-overrides",
            defaultEffect: "PERMIT",
            onEvaluationError: "skip-rule",
        });

        expect(set.algorithm).toBe("permit-overrides");
        expect(set.defaultEffect).toBe("PERMIT");
        expect(set.onEvaluationError).toBe("skip-rule");
    });

    it("rejects duplicate rule ids", () => {
        const other = AbacRule.of({
            id: "r",
            version: 2,
            effect: "DENY",
            condition: { field: "resource.locked", op: "eq", value: true },
        });

        expect(() => AbacPolicySet.of([rule, other])).toThrow(
            InvalidValueException,
        );
    });

    it("copies and freezes the rule list so later mutation cannot leak in", () => {
        const source = [rule];
        const set = AbacPolicySet.of(source);
        source.push(rule);

        expect(set.rules).toHaveLength(1);
        expect(Object.isFrozen(set.rules)).toBe(true);
    });
});
