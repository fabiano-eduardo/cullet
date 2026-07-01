import { describe, expect, it } from "vitest";

import { RequestedBy } from "../../application/commands/requested-by.js";

import { Grant } from "./grant.js";
import { Permission } from "./permission.js";
import { Role } from "./role.js";
import { Scope } from "./scope.js";

const USER = "550e8400-e29b-41d4-a716-446655440000";
const OTHER_USER = "11111111-1111-4111-8111-111111111111";

const cashier = () =>
    Role.of("cashier", [
        Permission.of("orders:read"),
        Permission.of("orders:cancel"),
    ]);

describe("Grant", () => {
    it("applies to the actor that owns it", () => {
        const grant = Grant.of({
            subject: RequestedBy.fromUser(USER),
            role: cashier(),
            scope: Scope.of("school:42"),
        });

        expect(grant.appliesTo(RequestedBy.fromUser(USER))).toBe(true);
        expect(grant.appliesTo(RequestedBy.fromUser(OTHER_USER))).toBe(false);
    });

    it("supports a system actor as the subject", () => {
        const grant = Grant.of({
            subject: RequestedBy.fromSystem("system:late-fee-job"),
            role: cashier(),
            scope: Scope.global(),
        });

        expect(
            grant.appliesTo(RequestedBy.fromSystem("system:late-fee-job")),
        ).toBe(true);
        expect(grant.subject.isSystem).toBe(true);
    });

    it("reconstructs the role and scope from their serialized form", () => {
        const grant = Grant.of({
            subject: RequestedBy.fromUser(USER),
            role: cashier(),
            scope: Scope.of("school:42"),
        });

        expect(grant.role.grants(Permission.of("orders:cancel"))).toBe(true);
        expect(grant.scope.toPrimitive()).toBe("school:42");
        expect(grant.subject.raw).toBe(USER);
    });

    it("serializes to a frozen primitive payload", () => {
        const grant = Grant.of({
            subject: RequestedBy.fromUser(USER),
            role: cashier(),
            scope: Scope.of("school:42"),
        });

        expect(grant.toPrimitive()).toEqual({
            subject: USER,
            role: {
                name: "cashier",
                permissions: ["orders:read", "orders:cancel"],
            },
            scope: "school:42",
        });
    });

    it("round-trips through fromProps", () => {
        const grant = Grant.of({
            subject: RequestedBy.fromUser(USER),
            role: cashier(),
            scope: Scope.of("school:42"),
        });

        const restored = Grant.fromProps(grant.toPrimitive());

        expect(restored.toPrimitive()).toEqual(grant.toPrimitive());
        expect(restored.appliesTo(RequestedBy.fromUser(USER))).toBe(true);
        expect(restored.role.grants(Permission.of("orders:cancel"))).toBe(true);
        expect(restored.scope.toPrimitive()).toBe("school:42");
    });

    it("rejects a malformed serialized payload loudly", () => {
        expect(() =>
            Grant.fromProps({
                subject: USER,
                role: { name: "cashier", permissions: ["not-a-permission"] },
                scope: "school:42",
            }),
        ).toThrow();
    });
});
