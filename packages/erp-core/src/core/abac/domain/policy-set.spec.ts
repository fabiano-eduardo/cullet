import { describe, expect, it } from "vitest";

import { AbacPolicySet } from "./policy-set.js";
import { AbacRule } from "./rule.js";

const rule = AbacRule.of({
    id: "r",
    version: 1,
    effect: "PERMIT",
    condition: { field: "resource.status", op: "eq", value: "OPEN" },
});

describe("AbacPolicySet", () => {
    it("closes by default: deny-overrides + DENY", () => {
        const set = AbacPolicySet.of([rule]);

        expect(set.algorithm).toBe("deny-overrides");
        expect(set.defaultEffect).toBe("DENY");
        expect(set.rules).toEqual([rule]);
    });

    it("honours explicit options", () => {
        const set = AbacPolicySet.of([rule], {
            algorithm: "permit-overrides",
            defaultEffect: "PERMIT",
        });

        expect(set.algorithm).toBe("permit-overrides");
        expect(set.defaultEffect).toBe("PERMIT");
    });

    it("copies and freezes the rule list so later mutation cannot leak in", () => {
        const source = [rule];
        const set = AbacPolicySet.of(source);
        source.push(rule);

        expect(set.rules).toHaveLength(1);
        expect(Object.isFrozen(set.rules)).toBe(true);
    });
});
