import { describe, expect, it } from "vitest";

import { InvalidValueException } from "../../exceptions/validation-exception.js";
import type { ConditionNode } from "../../policies/engines/v1/condition-types.js";

import { AbacRule } from "./rule.js";

const leaf: ConditionNode = {
    field: "resource.status",
    op: "eq",
    value: "OPEN",
};

describe("AbacRule", () => {
    it("builds a valid rule and exposes its parts", () => {
        const rule = AbacRule.of({
            id: "order.cancel.open",
            version: 3,
            effect: "PERMIT",
            condition: leaf,
            description: "cancel while open",
        });

        expect(rule.id).toBe("order.cancel.open");
        expect(rule.version).toBe(3);
        expect(rule.effect).toBe("PERMIT");
        expect(rule.condition).toEqual(leaf);
        expect(rule.description).toBe("cancel while open");
    });

    it("round-trips through toPrimitive and compares by content", () => {
        const props = {
            id: "r",
            version: 1,
            effect: "DENY" as const,
            condition: leaf,
        };
        const a = AbacRule.of(props);
        const b = AbacRule.of(props);

        expect(a.toPrimitive()).toEqual(props);
        expect(a.equals(b)).toBe(true);
    });

    it("deep-freezes the condition", () => {
        const rule = AbacRule.of({
            id: "r",
            version: 1,
            effect: "PERMIT",
            condition: { and: [leaf] },
        });

        expect(Object.isFrozen(rule.condition)).toBe(true);
    });

    it("rejects a blank id", () => {
        expect(() =>
            AbacRule.of({
                id: "   ",
                version: 1,
                effect: "PERMIT",
                condition: leaf,
            }),
        ).toThrow(InvalidValueException);
    });

    it("rejects a non-positive or non-integer version", () => {
        expect(() =>
            AbacRule.of({
                id: "r",
                version: 0,
                effect: "PERMIT",
                condition: leaf,
            }),
        ).toThrow(InvalidValueException);
        expect(() =>
            AbacRule.of({
                id: "r",
                version: 1.5,
                effect: "PERMIT",
                condition: leaf,
            }),
        ).toThrow(InvalidValueException);
    });

    it("rejects an unknown effect", () => {
        expect(() =>
            AbacRule.of({
                id: "r",
                version: 1,
                effect: "MAYBE" as unknown as "PERMIT",
                condition: leaf,
            }),
        ).toThrow(InvalidValueException);
    });

    describe("condition shape", () => {
        const bad = (condition: unknown) => () =>
            AbacRule.of({
                id: "r",
                version: 1,
                effect: "PERMIT",
                condition: condition as ConditionNode,
            });

        it("rejects a non-object condition", () => {
            expect(bad("nope")).toThrow(InvalidValueException);
        });

        it("rejects empty and/or nodes", () => {
            expect(bad({ and: [] })).toThrow(InvalidValueException);
            expect(bad({ or: [] })).toThrow(InvalidValueException);
        });

        it("rejects a leaf missing field or op, or with an unknown op", () => {
            expect(bad({ op: "eq", value: 1 })).toThrow(InvalidValueException);
            expect(bad({ field: "x", value: 1 })).toThrow(
                InvalidValueException,
            );
            expect(bad({ field: "x", op: "contains", value: 1 })).toThrow(
                InvalidValueException,
            );
            expect(bad({ field: 42, op: "eq", value: 1 })).toThrow(
                InvalidValueException,
            );
        });

        it("recurses into nested and/or/not nodes", () => {
            expect(bad({ not: { field: "x", op: "bogus" } })).toThrow(
                InvalidValueException,
            );
            expect(bad({ and: [{ or: [{ field: "x", op: "bad" }] }] })).toThrow(
                InvalidValueException,
            );
        });

        it("accepts a well-formed nested tree", () => {
            expect(
                bad({
                    and: [
                        leaf,
                        {
                            not: {
                                field: "resource.locked",
                                op: "eq",
                                value: true,
                            },
                        },
                        {
                            or: [
                                {
                                    field: "env.tier",
                                    op: "in",
                                    value: ["gold"],
                                },
                            ],
                        },
                    ],
                }),
            ).not.toThrow();
        });
    });
});
