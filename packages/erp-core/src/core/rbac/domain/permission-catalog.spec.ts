import { describe, expect, it } from "vitest";

import { InvalidValueException } from "../../exceptions/validation-exception.js";

import { definePermissionCatalog } from "./permission-catalog.js";
import { Permission } from "./permission.js";

describe("definePermissionCatalog", () => {
    const { permissions, all } = definePermissionCatalog({
        orders: ["read", "create", "cancel"],
        invoices: ["read", "issue"],
    });

    it("builds a Permission for every declared resource:action pair", () => {
        expect(permissions.orders.cancel).toBeInstanceOf(Permission);
        expect(permissions.orders.cancel.toPrimitive()).toBe("orders:cancel");
        expect(permissions.invoices.issue.toPrimitive()).toBe("invoices:issue");
    });

    it("lists every declared permission string in all", () => {
        expect(all).toEqual([
            "orders:read",
            "orders:create",
            "orders:cancel",
            "invoices:read",
            "invoices:issue",
        ]);
    });

    it("freezes the catalog and its lookups", () => {
        expect(Object.isFrozen(permissions)).toBe(true);
        expect(Object.isFrozen(permissions.orders)).toBe(true);
        expect(Object.isFrozen(all)).toBe(true);
    });

    it("rejects a wildcard entry — the catalog is the required side", () => {
        expect(() => definePermissionCatalog({ orders: ["*"] })).toThrow(
            InvalidValueException,
        );
        expect(() => definePermissionCatalog({ "*": ["read"] })).toThrow(
            InvalidValueException,
        );
    });

    it("rejects a malformed segment at construction", () => {
        expect(() => definePermissionCatalog({ orders: ["Cancel"] })).toThrow(
            InvalidValueException,
        );
        expect(() =>
            definePermissionCatalog({ "or ders": ["read"] }),
        ).toThrow(InvalidValueException);
    });
});
