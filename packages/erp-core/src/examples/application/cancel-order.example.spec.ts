import { describe, expect, it } from "vitest";

import type {
    PolicyEvaluationInput,
    PolicyEvaluationOutput,
    PolicyPort,
    PolicyPortError,
    ResultRepository,
} from "../../core/application/index.js";
import { RequestedBy } from "../../core/application/index.js";
import { AuthorizationError } from "../../core/errors/authorization-error.js";
import { IntegrationError } from "../../core/errors/integration-error.js";
import { NotFoundError } from "../../core/errors/not-found-error.js";
import {
    asPolicyDefinitionId,
    type GateStatus,
} from "../../core/policies/index.js";
import { Outcome } from "../../core/result/outcome.js";
import { Result } from "../../core/result/result.js";

import {
    CancelOrder,
    type CancelOrderError,
    type Order,
} from "./cancel-order.example.js";

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

/** A PolicyPort that always resolves to a GATE decision with the given status. */
class FixedGatePolicy implements PolicyPort {
    constructor(private readonly status: GateStatus) {}

    async evaluate(
        input: PolicyEvaluationInput,
    ): Promise<Result<PolicyEvaluationOutput, PolicyPortError>> {
        return Result.ok({
            decisionId: input.decisionId,
            ref: {
                definitionId: asPolicyDefinitionId("def-1"),
                policyKey: input.policyKey,
                policyVersion: "1",
                payloadHash: "hash",
                gateEngineVersion: 1,
            },
            kind: "GATE",
            asOf: new Date("2026-06-16T00:00:00.000Z"),
            evaluatedAt: new Date("2026-06-16T00:00:00.000Z"),
            contextVersion: input.contextVersion,
            decision: Outcome.of(this.status, { violations: [] }),
        });
    }
}

/** A PolicyPort that fails — exercising the in-band infra-error path. */
class FailingPolicy implements PolicyPort {
    async evaluate(): Promise<Result<PolicyEvaluationOutput, PolicyPortError>> {
        return Result.err(
            IntegrationError.unreachable({
                provider: "policy-service",
                operation: "evaluate",
                startedAtIso: "2026-06-16T00:00:00.000Z",
                durationMs: 12,
            }),
        );
    }
}

const command = (orders: InMemoryOrders, policies: PolicyPort) =>
    new CancelOrder(orders, policies);

const runCancel = (orders: InMemoryOrders, policies: PolicyPort) =>
    command(orders, policies).run({
        orderId: "order-1",
        tenantId: "tenant-1",
        schoolId: "school-1",
        requestedBy: RequestedBy.fromUser(VALID_USER),
    });

describe("CancelOrder example", () => {
    it("cancels the order and persists it when the policy allows", async () => {
        const orders = new InMemoryOrders({ id: "order-1", status: "OPEN" });

        const result = await runCancel(orders, new FixedGatePolicy("ALLOW"));

        expect(result.isOk()).toBe(true);
        expect(result.getOrThrow().status).toBe("CANCELLED");
        expect(orders.saved?.status).toBe("CANCELLED");
    });

    it("returns AuthorizationError without saving when the policy denies", async () => {
        const orders = new InMemoryOrders({ id: "order-1", status: "OPEN" });

        const result = await runCancel(orders, new FixedGatePolicy("DENY"));

        expect(result.isErr()).toBe(true);
        expect(result.errorOrNull()).toBeInstanceOf(AuthorizationError);
        expect(orders.saved).toBeNull();
    });

    it("returns NotFoundError when the order does not exist", async () => {
        const orders = new InMemoryOrders();

        const result = await runCancel(orders, new FixedGatePolicy("ALLOW"));

        expect(result.isErr()).toBe(true);
        expect(result.errorOrNull()).toBeInstanceOf(NotFoundError);
    });

    it("propagates a policy infrastructure failure as Result.err", async () => {
        const orders = new InMemoryOrders({ id: "order-1", status: "OPEN" });

        const result = await runCancel(orders, new FailingPolicy());

        expect(result.isErr()).toBe(true);
        expect(result.errorOrNull()).toBeInstanceOf(IntegrationError);
        expect(orders.saved).toBeNull();
    });
});
