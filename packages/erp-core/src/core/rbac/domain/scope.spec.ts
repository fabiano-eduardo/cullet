import { describe, expect, it } from "vitest";

import { InvalidValueException } from "../../exceptions/validation-exception.js";

import { Scope } from "./scope.js";

describe("Scope", () => {
    describe("parsing", () => {
        it("parses a type:id scope", () => {
            const scope = Scope.of("school:42");

            expect(scope.type).toBe("school");
            expect(scope.id).toBe("42");
            expect(scope.toPrimitive()).toBe("school:42");
        });

        it("parses a UUID id", () => {
            const scope = Scope.of(
                "tenant:550e8400-e29b-41d4-a716-446655440000",
            );

            expect(scope.type).toBe("tenant");
            expect(scope.id).toBe("550e8400-e29b-41d4-a716-446655440000");
        });

        it("exposes the global scope as type * with no id", () => {
            const scope = Scope.global();

            expect(scope.toPrimitive()).toBe("*");
            expect(scope.type).toBe("*");
            expect(scope.id).toBeUndefined();
        });

        it("rejects a blank value", () => {
            expect(() => Scope.of("  ")).toThrow(InvalidValueException);
        });

        it("rejects a value without an id", () => {
            expect(() => Scope.of("school:")).toThrow(InvalidValueException);
        });

        it("rejects a value without a type", () => {
            expect(() => Scope.of(":42")).toThrow(InvalidValueException);
        });
    });

    describe("includes", () => {
        it("contains everything from the global scope", () => {
            const global = Scope.global();

            expect(global.includes(Scope.of("school:42"))).toBe(true);
            expect(global.includes(Scope.global())).toBe(true);
        });

        it("contains only an exact match for a specific scope", () => {
            const school = Scope.of("school:42");

            expect(school.includes(Scope.of("school:42"))).toBe(true);
            expect(school.includes(Scope.of("school:99"))).toBe(false);
            expect(school.includes(Scope.global())).toBe(false);
        });
    });
});
