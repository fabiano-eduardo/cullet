import { describe, expect, it } from "vitest";

import { InvalidValueException } from "../../exceptions/validation-exception.js";

import { Permission } from "./permission.js";

describe("Permission", () => {
    describe("parsing", () => {
        it("parses a valid resource:action string", () => {
            const permission = Permission.of("orders:cancel");

            expect(permission.resource).toBe("orders");
            expect(permission.action).toBe("cancel");
            expect(permission.toPrimitive()).toBe("orders:cancel");
        });

        it("accepts a wildcard in the resource segment", () => {
            const permission = Permission.of("*:cancel");

            expect(permission.resource).toBe("*");
            expect(permission.action).toBe("cancel");
        });

        it("accepts a wildcard in the action segment", () => {
            const permission = Permission.of("orders:*");

            expect(permission.resource).toBe("orders");
            expect(permission.action).toBe("*");
        });

        it("accepts the super wildcard in both segments", () => {
            expect(Permission.of("*:*").toPrimitive()).toBe("*:*");
        });

        it("builds from already-separated parts via for()", () => {
            expect(Permission.for("orders", "read").toPrimitive()).toBe(
                "orders:read",
            );
        });

        it("rejects a partial wildcard", () => {
            expect(() => Permission.of("ord*:cancel")).toThrow(
                InvalidValueException,
            );
        });

        it("rejects a missing colon", () => {
            expect(() => Permission.of("orders")).toThrow(
                InvalidValueException,
            );
        });

        it("rejects more than one colon", () => {
            expect(() => Permission.of("orders:cancel:now")).toThrow(
                InvalidValueException,
            );
        });

        it("rejects an empty segment", () => {
            expect(() => Permission.of("orders:")).toThrow(
                InvalidValueException,
            );
            expect(() => Permission.of(":cancel")).toThrow(
                InvalidValueException,
            );
        });

        it("rejects a blank string", () => {
            expect(() => Permission.of("   ")).toThrow(InvalidValueException);
        });

        it("rejects uppercase characters", () => {
            expect(() => Permission.for("Orders", "cancel")).toThrow(
                InvalidValueException,
            );
        });
    });

    describe("implies", () => {
        const orderCancel = Permission.of("orders:cancel");
        const orderRead = Permission.of("orders:read");
        const invoiceRead = Permission.of("invoices:read");

        it("matches an exact permission only", () => {
            const granted = Permission.of("orders:cancel");

            expect(granted.implies(orderCancel)).toBe(true);
            expect(granted.implies(orderRead)).toBe(false);
            expect(granted.implies(invoiceRead)).toBe(false);
        });

        it("matches any action within the resource for an action wildcard", () => {
            const granted = Permission.of("orders:*");

            expect(granted.implies(orderCancel)).toBe(true);
            expect(granted.implies(orderRead)).toBe(true);
            expect(granted.implies(invoiceRead)).toBe(false);
        });

        it("matches the action across resources for a resource wildcard", () => {
            const granted = Permission.of("*:cancel");

            expect(granted.implies(orderCancel)).toBe(true);
            expect(granted.implies(orderRead)).toBe(false);
            expect(granted.implies(invoiceRead)).toBe(false);
        });

        it("matches everything for the super wildcard", () => {
            const granted = Permission.of("*:*");

            expect(granted.implies(orderCancel)).toBe(true);
            expect(granted.implies(orderRead)).toBe(true);
            expect(granted.implies(invoiceRead)).toBe(true);
        });
    });

    describe("hasWildcard", () => {
        it("is false for a fully concrete permission", () => {
            expect(Permission.of("orders:cancel").hasWildcard()).toBe(false);
        });

        it("is true when either segment is the wildcard", () => {
            expect(Permission.of("orders:*").hasWildcard()).toBe(true);
            expect(Permission.of("*:cancel").hasWildcard()).toBe(true);
            expect(Permission.of("*:*").hasWildcard()).toBe(true);
        });
    });

    describe("equality", () => {
        it("treats two permissions with the same parts as equal", () => {
            expect(
                Permission.of("orders:cancel").equals(
                    Permission.of("orders:cancel"),
                ),
            ).toBe(true);
        });

        it("treats differing permissions as unequal", () => {
            expect(
                Permission.of("orders:cancel").equals(
                    Permission.of("orders:read"),
                ),
            ).toBe(false);
        });
    });
});
