import type { PolicyContext } from "../policies/engines/gate-types.js";

import type { AbacRequest } from "./abac-request.js";

/**
 * Flattens an {@link AbacRequest} into the nested {@link PolicyContext} the
 * condition evaluator reads (it resolves dotted fields like `resource.status` by
 * walking nested objects). The actor lands as `subject.id`; the four attribute
 * bags nest under `subject` / `resource` / `action` / `env`; a `resource`
 * reference adds `resource.type` / `resource.id`; the request's action label
 * lands as `action.name`, so rules can discriminate by action without the
 * consumer duplicating it into the bag. The actor id, the resource reference
 * and the action name win over any same-named keys in the attribute bags.
 *
 * Consumers fold dynamic facts (e.g. RBAC roles/permissions derived from grants,
 * or a computed `ownerIsActor` flag) into `attributes.subject` / `resource` so
 * rules can reference `subject.roles`, `resource.ownerIsActor`, and the like.
 */
export function abacContext(request: AbacRequest): PolicyContext {
    const attributes = request.attributes;

    const subject: Record<string, unknown> = {
        ...attributes.subject,
        id: request.actor.raw,
    };

    const resource: Record<string, unknown> = { ...attributes.resource };
    if (request.resource) {
        resource.type = request.resource.type;
        if (request.resource.id !== undefined) {
            resource.id = request.resource.id;
        }
    }

    return {
        subject,
        resource,
        action: { ...attributes.action, name: request.action },
        env: { ...attributes.environment },
    };
}
