import { describe, expect, it } from "vitest";

import { RequestedBy } from "../../application/commands/requested-by.js";

import { Grant } from "./grant.js";
import { Permission } from "./permission.js";
import { PermissionSet } from "./permission-set.js";
import { Role } from "./role.js";
import { Scope } from "./scope.js";

const USER = "550e8400-e29b-41d4-a716-446655440000";

const grantOf = (role: Role, scope = Scope.global()) =>
    Grant.of({ subject: RequestedBy.fromUser(USER), role, scope });

describe("PermissionSet", () => {
    it("unions the permissions across several roles", () => {
        const set = PermissionSet.fromGrants([
            grantOf(Role.of("cashier", [Permission.of("orders:read")])),
            grantOf(Role.of("clerk", [Permission.of("invoices:read")])),
        ]);

        expect(set.toArray().map((p) => p.toPrimitive())).toEqual([
            "orders:read",
            "invoices:read",
        ]);
        expect(set.roleNames).toEqual(["cashier", "clerk"]);
    });

    it("deduplicates permissions and role names shared across grants", () => {
        const cashier = Role.of("cashier", [Permission.of("orders:read")]);
        const set = PermissionSet.fromGrants([
            grantOf(cashier, Scope.of("school:1")),
            grantOf(cashier, Scope.of("school:2")),
        ]);

        expect(set.toArray().map((p) => p.toPrimitive())).toEqual([
            "orders:read",
        ]);
        expect(set.roleNames).toEqual(["cashier"]);
    });

    it("resolves has() through wildcards", () => {
        const set = PermissionSet.fromGrants([
            grantOf(Role.of("manager", [Permission.of("orders:*")])),
        ]);

        expect(set.has(Permission.of("orders:cancel"))).toBe(true);
        expect(set.has(Permission.of("invoices:read"))).toBe(false);
    });

    it("is empty for no grants", () => {
        const set = PermissionSet.fromGrants([]);

        expect(set.toArray()).toEqual([]);
        expect(set.roleNames).toEqual([]);
        expect(set.has(Permission.of("orders:read"))).toBe(false);
    });
});
