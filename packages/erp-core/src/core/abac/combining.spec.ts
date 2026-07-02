import { describe, expect, it } from "vitest";

import { combine } from "./combining.js";
import { AbacRule } from "./domain/rule.js";

const permit = AbacRule.of({
    id: "permit",
    version: 1,
    effect: "PERMIT",
    condition: { field: "resource.status", op: "eq", value: "OPEN" },
});
const deny = AbacRule.of({
    id: "deny",
    version: 1,
    effect: "DENY",
    condition: { field: "resource.locked", op: "eq", value: true },
});
const permit2 = AbacRule.of({
    id: "permit-2",
    version: 1,
    effect: "PERMIT",
    condition: { field: "env.tier", op: "eq", value: "gold" },
});

describe("combine", () => {
    describe("deny-overrides", () => {
        it("lets any applicable DENY win", () => {
            expect(combine("deny-overrides", [permit, deny], "PERMIT")).toEqual(
                {
                    effect: "DENY",
                    decidingRule: deny,
                },
            );
        });

        it("permits via the first PERMIT when no DENY applies", () => {
            expect(
                combine("deny-overrides", [permit, permit2], "DENY"),
            ).toEqual({ effect: "PERMIT", decidingRule: permit });
        });

        it("falls back to the default when nothing applies", () => {
            expect(combine("deny-overrides", [], "DENY")).toEqual({
                effect: "DENY",
            });
        });
    });

    describe("permit-overrides", () => {
        it("lets any applicable PERMIT win", () => {
            expect(combine("permit-overrides", [deny, permit], "DENY")).toEqual(
                { effect: "PERMIT", decidingRule: permit },
            );
        });

        it("denies via the first DENY when no PERMIT applies", () => {
            expect(combine("permit-overrides", [deny], "PERMIT")).toEqual({
                effect: "DENY",
                decidingRule: deny,
            });
        });
    });

    describe("first-applicable", () => {
        it("takes the effect of the first rule in order", () => {
            expect(
                combine("first-applicable", [deny, permit], "PERMIT"),
            ).toEqual({ effect: "DENY", decidingRule: deny });
            expect(combine("first-applicable", [permit, deny], "DENY")).toEqual(
                { effect: "PERMIT", decidingRule: permit },
            );
        });

        it("falls back to the default when nothing applies", () => {
            expect(combine("first-applicable", [], "PERMIT")).toEqual({
                effect: "PERMIT",
            });
        });
    });
});
