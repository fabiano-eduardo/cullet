import { describe, expect, it } from "vitest";

import type { ResultRepository } from "../../core/application/index.js";
import { RequestedBy } from "../../core/application/index.js";
import { AuthorizationError } from "../../core/errors/authorization-error.js";
import { NotFoundError } from "../../core/errors/not-found-error.js";
import type { AccessRequest, AuthorizerPort } from "../../core/rbac/index.js";
import {
    Grant,
    Permission,
    RbacAuthorizer,
    Role,
    Scope,
} from "../../core/rbac/index.js";
import { Result } from "../../core/result/result.js";

import {
    CancelOrder,
    type CancelOrderError,
    type Order,
} from "./authorize-cancel-order.example.js";

const VALID_USER = "550e8400-e29b-41d4-a716-446655440000";

class InMemoryOrders implements ResultRepository<
    Order,
    string,
    CancelOrderError
> {
    private readonly store = new Map<string, Order>();
    public saved: Order | null = null;

    constructor(seed?: Order) {
        if (seed) {
            this.store.set(seed.id, seed);
        }
    }

    async findById(
        id: string,
    ): Promise<Result<Order | null, CancelOrderError>> {
        return Result.ok(this.store.get(id) ?? null);
    }

    async save(entity: Order): Promise<Result<void, CancelOrderError>> {
        this.saved = entity;
        this.store.set(entity.id, entity);
        return Result.ok(undefined);
    }

    async delete(): Promise<Result<void, CancelOrderError>> {
        return Result.ok(undefined);
    }
}

/**
 * The consumer-side adapter from §12.3: it loads the actor's grants (here a
 * fixed list) and delegates to the pure `RbacAuthorizer`.
 */
class StaticGrantsAuthorizer implements AuthorizerPort {
    private readonly engine = new RbacAuthorizer();

    constructor(private readonly grants: readonly Grant[]) {}

    async authorize(
        request: AccessRequest,
    ): Promise<Result<void, AuthorizationError>> {
        const decision = this.engine.authorize(request, this.grants);
        return decision.isErr()
            ? Result.err(decision.error)
            : Result.ok(undefined);
    }
}

const cancelGrant = (scope: Scope) =>
    Grant.of({
        subject: RequestedBy.fromUser(VALID_USER),
        role: Role.of("cashier", [Permission.of("orders:cancel")]),
        scope,
    });

const runCancel = (orders: InMemoryOrders, authorizer: AuthorizerPort) =>
    new CancelOrder(orders, authorizer).run({
        orderId: "order-1",
        schoolId: "1",
        requestedBy: RequestedBy.fromUser(VALID_USER),
    });

describe("authorize-cancel-order example", () => {
    it("cancels and persists the order when the authorizer allows", async () => {
        const orders = new InMemoryOrders({ id: "order-1", status: "OPEN" });

        const result = await runCancel(
            orders,
            new StaticGrantsAuthorizer([cancelGrant(Scope.of("school:1"))]),
        );

        expect(result.isOk()).toBe(true);
        expect(result.getOrThrow().status).toBe("CANCELLED");
        expect(orders.saved?.status).toBe("CANCELLED");
    });

    it("returns AuthorizationError without loading when the actor lacks the grant", async () => {
        const orders = new InMemoryOrders({ id: "order-1", status: "OPEN" });

        const result = await runCancel(orders, new StaticGrantsAuthorizer([]));

        expect(result.isErr()).toBe(true);
        expect(result.errorOrNull()).toBeInstanceOf(AuthorizationError);
        expect(orders.saved).toBeNull();
    });

    it("returns NotFoundError when authorized but the order is missing", async () => {
        const orders = new InMemoryOrders();

        const result = await runCancel(
            orders,
            new StaticGrantsAuthorizer([cancelGrant(Scope.global())]),
        );

        expect(result.isErr()).toBe(true);
        expect(result.errorOrNull()).toBeInstanceOf(NotFoundError);
    });
});
