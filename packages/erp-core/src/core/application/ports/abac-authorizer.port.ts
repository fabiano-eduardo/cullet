import type { AbacRequest } from "../../abac/abac-request.js";
import type { AuthorizationError } from "../../errors/authorization-error.js";
import type { Result } from "../../result/result.js";

/**
 * The seam an application layer injects to authorize an action by attributes —
 * symmetric to {@link AuthorizerPort} (RBAC). The use case depends only on this
 * contract; an adapter in the consumer's stack resolves the dynamic attributes
 * (resource state, environment, RBAC facts) and delegates the decision to the
 * pure `AbacAuthorizer`.
 *
 * Returns the decision as a {@link Result}: `ok(void)` when permitted, or
 * `err(AuthorizationError)` carrying `reason: "policy_denied"` (or `"forbidden"`
 * on a fail-closed evaluation error) that the HTTP boundary maps to a 403.
 */
interface AbacAuthorizerPort {
    authorize(request: AbacRequest): Promise<Result<void, AuthorizationError>>;
}

export type { AbacAuthorizerPort };
