/**
 * End-to-end reference for the ABAC seam: a concrete {@link Command} that refines
 * a mutation through an {@link AbacAuthorizerPort} — deciding on the *attributes*
 * of the request (the order's live status, the environment) rather than a static
 * capability.
 *
 * Unlike the RBAC example, the aggregate is loaded *before* authorizing: ABAC
 * reasons over resource state, so that state has to exist first. A denial comes
 * back as `Result.err(AuthorizationError)` (translated to a 403 at the edge); a
 * missing aggregate or a repository failure stays in band as `Result.err` too —
 * the "errors as values" contract, never a thrown exception.
 *
 * Consumers import these symbols from `@cullet/erp-core` and
 * `@cullet/erp-core/abac`; inside the kit we use relative paths so the example
 * stays compilable and test-covered, guarding the README/KIT_CONTEXT snippet
 * against rot.
 */
import type { AbacAuthorizerPort } from "../../core/abac/index.js";
import { Command, type CommandInput } from "../../core/application/index.js";
import type { ResultRepository } from "../../core/application/index.js";
import { AuthorizationError } from "../../core/errors/authorization-error.js";
import { NotFoundError } from "../../core/errors/not-found-error.js";
import { Result } from "../../core/result/result.js";

// ─── Minimal domain ─────────────────────────────────────────────────────────

type OrderStatus = "OPEN" | "CANCELLED";

interface Order {
    readonly id: string;
    readonly status: OrderStatus;
    readonly locked: boolean;
}

// ─── Command contract ────────────────────────────────────────────────────────

interface CancelOrderInput extends CommandInput {
    readonly orderId: string;
    /** An environment attribute the composition root resolves from its clock. */
    readonly businessHours: boolean;
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
        private readonly authorizer: AbacAuthorizerPort,
    ) {
        super();
    }

    protected async execute(
        input: CancelOrderInput,
    ): Promise<Result<Order, CancelOrderError>> {
        // 1. Load the aggregate — its live state feeds the ABAC decision.
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

        // 2. Gate on attributes: the order's status/lock plus the environment.
        //    `CommandInput.requestedBy` is the ABAC subject.
        const allowed = await this.authorizer.authorize({
            actor: input.requestedBy,
            action: "order.cancel",
            resource: { type: "Order", id: order.id },
            attributes: {
                resource: { status: order.status, locked: order.locked },
                environment: { businessHours: input.businessHours },
            },
        });
        if (allowed.isErr()) {
            // AuthorizationError → 403 at the boundary.
            return Result.err(allowed.error);
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
