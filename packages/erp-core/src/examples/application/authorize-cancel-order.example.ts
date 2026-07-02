/**
 * End-to-end reference for the RBAC seam: a concrete {@link Command} that gates
 * a mutation through an {@link AuthorizerPort} before touching the aggregate.
 *
 * Flow: ask the injected authorizer whether the actor may cancel the order →
 * load the aggregate → mutate and persist. An authorization denial comes back
 * as `Result.err(AuthorizationError)` (translated to a 403 at the edge), and a
 * missing aggregate or a repository failure stays in band as `Result.err`
 * too — the "errors as values" contract, never a thrown exception.
 *
 * Consumers import these symbols from `@cullet/erp-core` and
 * `@cullet/erp-core/rbac`; inside the kit we use relative paths so the example
 * stays compilable and test-covered, guarding the README/KIT_CONTEXT snippet
 * against rot.
 */
import { Command, type CommandInput } from "../../core/application/index.js";
import type { ResultRepository } from "../../core/application/index.js";
import type { AuthorizerPort } from "../../core/application/ports/authorizer.port.js";
import { AuthorizationError } from "../../core/errors/authorization-error.js";
import { NotFoundError } from "../../core/errors/not-found-error.js";
import { Permission, Scope } from "../../core/rbac/index.js";
import { Result } from "../../core/result/result.js";

// ─── Minimal domain ─────────────────────────────────────────────────────────

type OrderStatus = "OPEN" | "CANCELLED";

interface Order {
    readonly id: string;
    readonly status: OrderStatus;
}

// ─── Command contract ────────────────────────────────────────────────────────

interface CancelOrderInput extends CommandInput {
    readonly orderId: string;
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
        private readonly authorizer: AuthorizerPort,
    ) {
        super();
    }

    protected async execute(
        input: CancelOrderInput,
    ): Promise<Result<Order, CancelOrderError>> {
        // 1. Gate the action. `CommandInput.requestedBy` is the RBAC actor.
        const allowed = await this.authorizer.authorize({
            actor: input.requestedBy,
            action: "order.cancel",
            required: Permission.of("orders:cancel"),
            resource: { type: "Order", id: input.orderId },
            scope: Scope.of(`school:${input.schoolId}`),
        });
        if (allowed.isErr()) {
            // AuthorizationError → 403 at the boundary.
            return Result.err(allowed.error);
        }

        // 2. Load the aggregate. Infra failures stay in band as Result.err.
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
