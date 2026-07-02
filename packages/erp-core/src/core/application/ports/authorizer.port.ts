import type { AuthorizationError } from "../../errors/authorization-error.js";
import type { AccessRequest } from "../../rbac/access-request.js";
import type { Result } from "../../result/result.js";

/**
 * The seam an application layer injects to authorize an action — symmetric to
 * {@link PolicyPort}. The use case depends only on this contract; an adapter in
 * the consumer's stack loads the actor's grants (from its own store) and
 * delegates the decision to the pure `RbacAuthorizer`.
 *
 * Returns the decision as a {@link Result}: `ok(void)` when allowed, or
 * `err(AuthorizationError)` carrying the discriminated `reason` the HTTP
 * boundary maps to a 403. Promised here under `[extension-points]` in
 * KIT_CONTEXT.md.
 */
interface AuthorizerPort {
    authorize(
        request: AccessRequest,
    ): Promise<Result<void, AuthorizationError>>;
}

export type { AuthorizerPort };
