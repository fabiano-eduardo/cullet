/**
 * End-to-end reference: a concrete {@link Command} wiring a
 * {@link ResultRepository} and a {@link PolicyPort} together.
 *
 * Flow: load the aggregate → ask a declarative policy whether the action is
 * allowed → mutate and persist. Every recoverable failure (infra error from
 * the repository, a policy `DENY`, a missing aggregate, an optimistic-locking
 * conflict on save) is returned as a typed `Result.err(...)` rather than
 * thrown — the "errors as values" contract that `Command`/`UseCase` enforce.
 *
 * Consumers import these symbols from the package root (`@cullet/erp-core`);
 * inside the kit we use relative paths so the example stays compilable and
 * test-covered, guarding the snippet in the README/KIT_CONTEXT against rot.
 */
import { Command, type CommandInput } from "../../core/application/index.js";
import type {
    PolicyPort,
    ResultRepository,
} from "../../core/application/index.js";
import { AuthorizationError } from "../../core/errors/authorization-error.js";
import { NotFoundError } from "../../core/errors/not-found-error.js";
import {
    asPolicyDecisionId,
    asSchoolId,
    asTenantId,
} from "../../core/policies/index.js";
import { Result } from "../../core/result/result.js";

// ─── Minimal domain ─────────────────────────────────────────────────────────

type OrderStatus = "OPEN" | "CANCELLED";

interface Order {
    readonly id: string;
    readonly status: OrderStatus;
}

// ─── Command contract ────────────────────────────────────────────────────────

// `CommandInput` forces every mutation to record *who* triggered it.
interface CancelOrderInput extends CommandInput {
    readonly orderId: string;
    readonly tenantId: string;
    readonly schoolId: string;
}

type CancelOrderError = NotFoundError | AuthorizationError;

// ─── The use case ─────────────────────────────────────────────────────────────

class CancelOrder extends Command<
    CancelOrderInput,
    Result<Order, CancelOrderError>
> {
    constructor(
        private readonly orders: ResultRepository<
            Order,
            string,
            CancelOrderError
        >,
        private readonly policies: PolicyPort,
    ) {
        super();
    }

    protected async execute(
        input: CancelOrderInput,
    ): Promise<Result<Order, CancelOrderError>> {
        // 1. Load the aggregate. Infra failures stay in band as Result.err.
        const found = await this.orders.findById(input.orderId);
        if (found.isErr()) {
            return found;
        }

        const order = found.getOrThrow();
        if (!order) {
            return Result.err(
                new NotFoundError("Order", { id: input.orderId }),
            );
        }

        // 2. Decide via a declarative policy (a GATE returns ALLOW/DENY).
        const evaluated = await this.policies.evaluate({
            decisionId: asPolicyDecisionId(input.orderId),
            policyKey: "order.cancel",
            scopeChain: [],
            contextVersion: 1,
            seed: {
                tenantId: asTenantId(input.tenantId),
                schoolId: asSchoolId(input.schoolId),
                fields: { orderStatus: order.status },
            },
        });
        if (evaluated.isErr()) {
            return evaluated;
        }

        const result = evaluated.getOrThrow();
        if (result.kind === "GATE" && result.decision.status === "DENY") {
            return Result.err(
                AuthorizationError.policyDenied({
                    action: "order.cancel",
                    resource: { type: "Order", id: order.id },
                    policyId: result.ref.definitionId,
                    policyVersion: Number(result.ref.policyVersion),
                    evaluatedAtIso: result.evaluatedAt.toISOString(),
                }),
            );
        }

        // 3. Mutate and persist. A version conflict on save also surfaces as
        //    Result.err — never an exception crossing the boundary.
        const cancelled: Order = { ...order, status: "CANCELLED" };
        const saved = await this.orders.save(cancelled);
        if (saved.isErr()) {
            return saved;
        }

        return Result.ok(cancelled);
    }
}

export { CancelOrder };
export type { CancelOrderError, CancelOrderInput, Order, OrderStatus };
