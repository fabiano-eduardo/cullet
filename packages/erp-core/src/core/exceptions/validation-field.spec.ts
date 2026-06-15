import { describe, expect, it } from "vitest";

import { ValidationField } from "./validation-field.js";

describe("ValidationField", () => {
    describe("of()", () => {
        it("creates a field with the provided value", () => {
            const field = ValidationField.of("email");

            expect(field.value).toBe("email");
        });

        it("creates distinct instances on separate calls", () => {
            const a = ValidationField.of("name");
            const b = ValidationField.of("name");

            expect(a).not.toBe(b);
            expect(a.value).toBe(b.value);
        });

        it("accepts an empty string", () => {
            const field = ValidationField.of("");

            expect(field.value).toBe("");
        });

        it("accepts dotted paths", () => {
            const field = ValidationField.of("address.zipCode");

            expect(field.value).toBe("address.zipCode");
        });
    });

    describe("nested()", () => {
        it("creates a nested path from a string", () => {
            const parent = ValidationField.of("address");
            const child = parent.nested("zipCode");

            expect(child.value).toBe("address.zipCode");
        });

        it("creates a nested path from another ValidationField", () => {
            const parent = ValidationField.of("user");
            const subField = ValidationField.of("document");
            const child = parent.nested(subField);

            expect(child.value).toBe("user.document");
        });

        it("chains multiple nesting levels", () => {
            const root = ValidationField.of("order");
            const level1 = root.nested("items");
            const level2 = level1.nested("price");

            expect(level2.value).toBe("order.items.price");
        });

        it("returns a new instance without mutating the parent", () => {
            const parent = ValidationField.of("parent");
            const child = parent.nested("child");

            expect(parent.value).toBe("parent");
            expect(child.value).toBe("parent.child");
        });
    });

    describe("toString()", () => {
        it("returns the field value", () => {
            const field = ValidationField.of("fullName");

            expect(field.toString()).toBe("fullName");
        });

        it("returns the full path for nested fields", () => {
            const field = ValidationField.of("a").nested("b").nested("c");

            expect(field.toString()).toBe("a.b.c");
        });
    });

    describe("equals()", () => {
        it("returns true for fields with the same value", () => {
            const a = ValidationField.of("email");
            const b = ValidationField.of("email");

            expect(a.equals(b)).toBe(true);
        });

        it("returns false for fields with different values", () => {
            const a = ValidationField.of("email");
            const b = ValidationField.of("phone");

            expect(a.equals(b)).toBe(false);
        });

        it("treats a dotted simple field as equal to the equivalent nested field", () => {
            const simple = ValidationField.of("a.b");
            const nested = ValidationField.of("a").nested("b");

            expect(simple.equals(nested)).toBe(true);
        });
    });
});
