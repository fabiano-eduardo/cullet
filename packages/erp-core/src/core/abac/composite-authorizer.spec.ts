import { describe, expect, it } from "vitest";

import { RequestedBy } from "../application/commands/requested-by.js";
import type { AbacAuthorizerPort } from "../application/ports/abac-authorizer.port.js";
import type { AuthorizerPort } from "../application/ports/authorizer.port.js";
import { AuthorizationError } from "../errors/authorization-error.js";
import { Permission } from "../rbac/domain/permission.js";
import { Scope } from "../rbac/domain/scope.js";
import { Result } from "../result/result.js";

import {
    CompositeAuthorizer,
    type CompositeAccessRequest,
} from "./composite-authorizer.js";

const ok = (): Result<void, AuthorizationError> => Result.ok(undefined);
const denied = (): Result<void, AuthorizationError> =>
    Result.err(AuthorizationError.forbidden({ action: "order.cancel" }));

// Real (non-mock) stubs implementing the two seams — satisfies noMocksInCore.
class RbacStub implements AuthorizerPort {
    constructor(private readonly outcome: Result<void, AuthorizationError>) {}
    async authorize(): Promise<Result<void, AuthorizationError>> {
        return this.outcome;
    }
}

class AbacStub implements AbacAuthorizerPort {
    public called = false;
    constructor(private readonly outcome: Result<void, AuthorizationError>) {}
    async authorize(): Promise<Result<void, AuthorizationError>> {
        this.called = true;
        return this.outcome;
    }
}

const request: CompositeAccessRequest = {
    actor: RequestedBy.fromUser("550e8400-e29b-41d4-a716-446655440000"),
    action: "order.cancel",
    required: Permission.of("orders:cancel"),
    scope: Scope.of("school:1"),
    attributes: { resource: { status: "OPEN" } },
};

describe("CompositeAuthorizer", () => {
    it("short-circuits with the RBAC denial and never runs ABAC", async () => {
        const abac = new AbacStub(ok());
        const result = await new CompositeAuthorizer(
            new RbacStub(denied()),
            abac,
        ).authorize(request);

        expect(result.isErr()).toBe(true);
        expect(abac.called).toBe(false);
    });

    it("refines with ABAC once RBAC allows", async () => {
        const result = await new CompositeAuthorizer(
            new RbacStub(ok()),
            new AbacStub(denied()),
        ).authorize(request);

        expect(result.isErr()).toBe(true);
    });

    it("allows when both seams allow", async () => {
        const result = await new CompositeAuthorizer(
            new RbacStub(ok()),
            new AbacStub(ok()),
        ).authorize(request);

        expect(result.isOk()).toBe(true);
    });
});
