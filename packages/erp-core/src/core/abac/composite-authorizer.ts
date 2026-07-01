import { Result } from "../result/result.js";
import type { AbacAuthorizerPort } from "../application/ports/abac-authorizer.port.js";
import type { AuthorizerPort } from "../application/ports/authorizer.port.js";
import type { AuthorizationError } from "../errors/authorization-error.js";
import type { AccessRequest } from "../rbac/access-request.js";

import type { AbacAttributes } from "./abac-request.js";

/**
 * The request a {@link CompositeAuthorizer} accepts — one object that satisfies
 * both the RBAC {@link AccessRequest} (its `required`/`scope`) and the ABAC
 * request (its `attributes`).
 */
type CompositeAccessRequest = AccessRequest & {
    readonly attributes: AbacAttributes;
};

/**
 * Runs a coarse RBAC check first, then refines with ABAC — the standard hybrid
 * "does the actor hold the capability, *and* do the attributes allow it here?"
 * flow. Short-circuits with the RBAC denial when the actor is not even capable,
 * so the boundary sees the most specific 403.
 *
 * Only the two port interfaces are referenced (both erased at runtime), so this
 * pulls in no RBAC/ABAC engine code of its own — it just sequences the seams the
 * consumer wires up.
 */
class CompositeAuthorizer {
    constructor(
        private readonly rbac: AuthorizerPort,
        private readonly abac: AbacAuthorizerPort,
    ) {}

    async authorize(
        request: CompositeAccessRequest,
    ): Promise<Result<void, AuthorizationError>> {
        const coarse = await this.rbac.authorize(request);
        if (coarse.isErr()) {
            return coarse;
        }
        return this.abac.authorize(request);
    }
}

export { CompositeAuthorizer, type CompositeAccessRequest };
