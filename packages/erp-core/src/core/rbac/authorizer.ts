import {
    AuthorizationError,
    type AuthorizationRequirement,
} from "../errors/authorization-error.js";
import { ValidationCode } from "../exceptions/validation-code.js";
import { InvalidValueException } from "../exceptions/validation-exception.js";
import { ValidationField } from "../exceptions/validation-field.js";
import { Result } from "../result/result.js";

import type { AccessRequest } from "./access-request.js";
import type { Grant } from "./domain/grant.js";

const REQUIRED_FIELD = ValidationField.of("required");

/**
 * The pure RBAC decisor. Given an {@link AccessRequest} and the {@link Grant}s
 * already loaded for the actor, it answers "may this actor do this?" with no
 * I/O — no storage, no network, no clock — returning a {@link Result}. An
 * authorization *decision* is never thrown, always a value, mirroring the
 * "errors as values" contract of `UseCase`/`PolicyService`. Loading the grants
 * is the consumer's job (behind an `AuthorizerPort` adapter); this class only
 * decides.
 *
 * The one thing it *does* throw is {@link InvalidValueException} when the caller
 * misuses the API by passing a wildcard `required` permission — that is a
 * programming error surfaced loudly, not an authorization outcome.
 */
class RbacAuthorizer {
    /**
     * Decides the request against the supplied grants. The checks run
     * role → capability → scope so the denial reason is the most informative
     * one available:
     *
     * 1. no grant for the actor → `missing_role`;
     * 2. has grants but none grants the permission → `missing_capability`;
     * 3. grants the permission but not in scope → `out_of_scope`;
     * 4. otherwise → ALLOW (`Result.ok`).
     *
     * @throws {@link InvalidValueException} when `request.required` is a wildcard
     *   permission (only *granted* permissions may wildcard, never the *required*
     *   one).
     */
    authorize(
        request: AccessRequest,
        grants: readonly Grant[],
    ): Result<void, AuthorizationError> {
        if (request.required.hasWildcard()) {
            throw new InvalidValueException(
                REQUIRED_FIELD,
                ValidationCode.INVALID_FORMAT,
                `AccessRequest.required must be a concrete permission, not a wildcard, got "${request.required.toPrimitive()}"`,
            );
        }

        const required: AuthorizationRequirement = {
            capability: request.required.toPrimitive(),
            scope: request.scope.toPrimitive(),
        };
        const metadata = {
            action: request.action,
            resource: request.resource,
            actor: { actorId: request.actor.raw },
            required,
        };

        const actorGrants = grants.filter((grant) =>
            grant.appliesTo(request.actor),
        );
        if (actorGrants.length === 0) {
            return Result.err(AuthorizationError.missingRole(metadata));
        }

        const withPermission = actorGrants.filter((grant) =>
            grant.role.grants(request.required),
        );
        if (withPermission.length === 0) {
            return Result.err(AuthorizationError.missingCapability(metadata));
        }

        const inScope = withPermission.filter((grant) =>
            grant.scope.includes(request.scope),
        );
        if (inScope.length === 0) {
            return Result.err(AuthorizationError.outOfScope(metadata));
        }

        return Result.ok(undefined);
    }
}

export { RbacAuthorizer };
