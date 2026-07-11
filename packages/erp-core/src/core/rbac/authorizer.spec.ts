import { describe, expect, it } from "vitest";

import { RequestedBy } from "../application/commands/requested-by.js";
import { AuthorizationError } from "../errors/authorization-error.js";
import { ErrorCodes } from "../errors/error-codes.js";
import { InvalidValueException } from "../exceptions/validation-exception.js";

import type { AccessRequest } from "./access-request.js";
import { RbacAuthorizer } from "./authorizer.js";
import { Grant } from "./domain/grant.js";
import { Permission } from "./domain/permission.js";
import { Role } from "./domain/role.js";
import { Scope } from "./domain/scope.js";

const USER = "550e8400-e29b-41d4-a716-446655440000";
const OTHER_USER = "11111111-1111-4111-8111-111111111111";

const actor = RequestedBy.fromUser(USER);
const authorizer = new RbacAuthorizer();

const request: AccessRequest = {
    actor,
    action: "order.cancel",
    required: Permission.of("orders:cancel"),
    resource: { type: "Order", id: "order-1" },
    scope: Scope.of("school:42"),
};

const grantFor = (subject: RequestedBy, role: Role, scope: Scope): Grant =>
    Grant.of({ subject, role, scope });

const cashier = Role.of("cashier", [
    Permission.of("orders:read"),
    Permission.of("orders:cancel"),
]);
const viewer = Role.of("viewer", [Permission.of("orders:read")]);

describe("RbacAuthorizer", () => {
    it("allows when a grant covers the permission in scope", () => {
        const result = authorizer.authorize(request, [
            grantFor(actor, cashier, Scope.of("school:42")),
        ]);

        expect(result.isOk()).toBe(true);
        expect(() => result.getOrThrow()).not.toThrow();
    });

    it("allows via the global scope", () => {
        const result = authorizer.authorize(request, [
            grantFor(actor, cashier, Scope.global()),
        ]);

        expect(result.isOk()).toBe(true);
    });

    it("rejects a wildcard required permission as caller misuse", () => {
        const wildcard: AccessRequest = {
            ...request,
            required: Permission.of("orders:*"),
        };

        expect(() =>
            authorizer.authorize(wildcard, [
                grantFor(actor, cashier, Scope.of("school:42")),
            ]),
        ).toThrow(InvalidValueException);
    });

    it("denies with missing_role when the actor has no grant", () => {
        const result = authorizer.authorize(request, []);

        expect(result.isErr()).toBe(true);
        const error = result.errorOrNull();
        expect(error).toBeInstanceOf(AuthorizationError);
        expect(error?.reason).toBe("missing_role");
        expect(error?.code).toBe(ErrorCodes.authorization.missingRole);
    });

    it("ignores grants that belong to another actor", () => {
        const result = authorizer.authorize(request, [
            grantFor(
                RequestedBy.fromUser(OTHER_USER),
                cashier,
                Scope.of("school:42"),
            ),
        ]);

        expect(result.errorOrNull()?.reason).toBe("missing_role");
    });

    it("denies with missing_capability when no role grants the permission", () => {
        const result = authorizer.authorize(request, [
            grantFor(actor, viewer, Scope.of("school:42")),
        ]);

        expect(result.errorOrNull()?.reason).toBe("missing_capability");
        expect(result.errorOrNull()?.code).toBe(
            ErrorCodes.authorization.missingCapability,
        );
    });

    it("denies with out_of_scope when the permission is held in another scope", () => {
        const result = authorizer.authorize(request, [
            grantFor(actor, cashier, Scope.of("school:99")),
        ]);

        expect(result.errorOrNull()?.reason).toBe("out_of_scope");
        expect(result.errorOrNull()?.code).toBe(
            ErrorCodes.authorization.outOfScope,
        );
    });

    it("fills the denial metadata for the boundary to translate", () => {
        const error = authorizer
            .authorize(request, [
                grantFor(actor, viewer, Scope.of("school:42")),
            ])
            .errorOrNull();

        expect(error?.metadata).toMatchObject({
            reason: "missing_capability",
            action: "order.cancel",
            resource: { type: "Order", id: "order-1" },
            actor: { actorId: USER },
            required: { capability: "orders:cancel", scope: "school:42" },
        });
    });

    it("allows when one of several grants for the actor is in scope", () => {
        const result = authorizer.authorize(request, [
            grantFor(actor, cashier, Scope.of("school:99")), // out of scope
            grantFor(actor, cashier, Scope.of("school:42")), // in scope
        ]);

        expect(result.isOk()).toBe(true);
    });

    it("allows when a role grants the permission via a wildcard", () => {
        const manager = Role.of("manager", [Permission.of("orders:*")]);

        const result = authorizer.authorize(request, [
            grantFor(actor, manager, Scope.of("school:42")),
        ]);

        expect(result.isOk()).toBe(true);
    });

    it("matches the grant when actor and subject UUIDs differ only in case", () => {
        const upper = RequestedBy.fromUser(USER.toUpperCase());
        const result = authorizer.authorize({ ...request, actor: upper }, [
            grantFor(
                RequestedBy.fromUser(USER),
                cashier,
                Scope.of("school:42"),
            ),
        ]);

        expect(result.isOk()).toBe(true);
    });
});
