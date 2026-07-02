import { describe, expect, it } from "vitest";

import { RequestedBy } from "../application/commands/requested-by.js";

import { Grant } from "./domain/grant.js";
import { Permission } from "./domain/permission.js";
import { Role } from "./domain/role.js";
import { Scope } from "./domain/scope.js";
import { rbacContextFields } from "./policy-bridge.js";

const USER = "550e8400-e29b-41d4-a716-446655440000";
const OTHER_USER = "11111111-1111-4111-8111-111111111111";

const actor = RequestedBy.fromUser(USER);

describe("rbacContextFields", () => {
    it("projects the actor's roles and permissions into flat fields", () => {
        const grants = [
            Grant.of({
                subject: actor,
                role: Role.of("cashier", [
                    Permission.of("orders:read"),
                    Permission.of("orders:cancel"),
                ]),
                scope: Scope.of("school:42"),
            }),
        ];

        expect(rbacContextFields(actor, grants)).toEqual({
            "actor.id": USER,
            "actor.roles": ["cashier"],
            "actor.permissions": ["orders:read", "orders:cancel"],
        });
    });

    it("ignores grants that belong to another actor", () => {
        const grants = [
            Grant.of({
                subject: RequestedBy.fromUser(OTHER_USER),
                role: Role.of("admin", [Permission.of("*:*")]),
                scope: Scope.global(),
            }),
        ];

        expect(rbacContextFields(actor, grants)).toEqual({
            "actor.id": USER,
            "actor.roles": [],
            "actor.permissions": [],
        });
    });
});
