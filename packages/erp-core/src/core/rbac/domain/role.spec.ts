import { describe, expect, it } from "vitest";

import { InvalidValueException } from "../../exceptions/validation-exception.js";

import { Permission } from "./permission.js";
import { Role } from "./role.js";

describe("Role", () => {
    it("grants a required permission held directly", () => {
        const role = Role.of("cashier", [
            Permission.of("orders:read"),
            Permission.of("orders:cancel"),
        ]);

        expect(role.grants(Permission.of("orders:cancel"))).toBe(true);
    });

    it("grants a required permission held via wildcard", () => {
        const role = Role.of("manager", [Permission.of("orders:*")]);

        expect(role.grants(Permission.of("orders:cancel"))).toBe(true);
    });

    it("does not grant a permission it lacks", () => {
        const role = Role.of("cashier", [Permission.of("orders:read")]);

        expect(role.grants(Permission.of("orders:cancel"))).toBe(false);
    });

    it("rehydrates permissions from their stored primitive form", () => {
        const role = Role.of("manager", [
            Permission.of("orders:*"),
            Permission.of("invoices:read"),
        ]);

        expect(role.permissions.map((p) => p.toPrimitive())).toEqual([
            "orders:*",
            "invoices:read",
        ]);
    });

    it("deduplicates repeated permissions preserving first-seen order", () => {
        const role = Role.of("cashier", [
            Permission.of("orders:read"),
            Permission.of("orders:read"),
            Permission.of("orders:cancel"),
        ]);

        expect(role.toPrimitive()).toEqual({
            name: "cashier",
            permissions: ["orders:read", "orders:cancel"],
        });
    });

    it("round-trips through fromProps", () => {
        const role = Role.of("admin", [Permission.of("*:*")]);

        const restored = Role.fromProps(role.toPrimitive());

        expect(restored.equals(role)).toBe(true);
        expect(restored.grants(Permission.of("invoices:delete"))).toBe(true);
    });

    it("rejects a blank name", () => {
        expect(() => Role.of("  ", [Permission.of("orders:read")])).toThrow(
            InvalidValueException,
        );
    });
});
