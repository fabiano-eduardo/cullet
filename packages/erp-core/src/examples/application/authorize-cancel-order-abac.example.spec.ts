import { describe, expect, it } from "vitest";

import {
    AbacAuthorizer,
    AbacPolicySet,
    AbacRule,
} from "../../core/abac/index.js";
import type { AbacAuthorizerPort, AbacRequest } from "../../core/abac/index.js";
import type { ResultRepository } from "../../core/application/index.js";
import { RequestedBy } from "../../core/application/index.js";
import { AuthorizationError } from "../../core/errors/authorization-error.js";
import { NotFoundError } from "../../core/errors/not-found-error.js";
import { Result } from "../../core/result/result.js";

import {
    CancelOrder,
    type CancelOrderError,
    type Order,
} from "./authorize-cancel-order-abac.example.js";

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

// The consumer-side policy set: permit an OPEN order in business hours, but a
// DENY rule (deny-overrides) hard-stops a locked order.
const POLICIES = AbacPolicySet.of([
    AbacRule.of({
        id: "order.cancel.open-in-hours",
        version: 1,
        effect: "PERMIT",
        condition: {
            and: [
                { field: "resource.status", op: "eq", value: "OPEN" },
                { field: "env.businessHours", op: "eq", value: true },
            ],
        },
    }),
    AbacRule.of({
        id: "order.cancel.deny-locked",
        version: 1,
        effect: "DENY",
        condition: { field: "resource.locked", op: "eq", value: true },
    }),
]);

// The consumer's adapter: wraps the pure decisor with a fixed policy set.
class StaticPolicyAuthorizer implements AbacAuthorizerPort {
    private readonly engine = new AbacAuthorizer();

    async authorize(
        request: AbacRequest,
    ): Promise<Result<void, AuthorizationError>> {
        const decision = this.engine.authorize(request, POLICIES);
        return decision.isErr()
            ? Result.err(decision.error)
            : Result.ok(undefined);
    }
}

const runCancel = (orders: InMemoryOrders, businessHours: boolean) =>
    new CancelOrder(orders, new StaticPolicyAuthorizer()).run({
        orderId: "order-1",
        businessHours,
        requestedBy: RequestedBy.fromUser(VALID_USER),
    });

describe("authorize-cancel-order (ABAC) example", () => {
    it("cancels and persists when the order is OPEN and it is business hours", async () => {
        const orders = new InMemoryOrders({
            id: "order-1",
            status: "OPEN",
            locked: false,
        });

        const result = await runCancel(orders, true);

        expect(result.isOk()).toBe(true);
        expect(result.getOrThrow().status).toBe("CANCELLED");
        expect(orders.saved?.status).toBe("CANCELLED");
    });

    it("denies via the closed default outside business hours, without persisting", async () => {
        const orders = new InMemoryOrders({
            id: "order-1",
            status: "OPEN",
            locked: false,
        });

        const result = await runCancel(orders, false);

        expect(result.isErr()).toBe(true);
        expect(result.errorOrNull()).toBeInstanceOf(AuthorizationError);
        expect(orders.saved).toBeNull();
    });

    it("denies a locked order via the DENY rule even in business hours", async () => {
        const orders = new InMemoryOrders({
            id: "order-1",
            status: "OPEN",
            locked: true,
        });

        const result = await runCancel(orders, true);

        expect(result.errorOrNull()).toBeInstanceOf(AuthorizationError);
        expect(orders.saved).toBeNull();
    });

    it("returns NotFoundError when the order is missing", async () => {
        const orders = new InMemoryOrders();

        const result = await runCancel(orders, true);

        expect(result.isErr()).toBe(true);
        expect(result.errorOrNull()).toBeInstanceOf(NotFoundError);
    });
});
