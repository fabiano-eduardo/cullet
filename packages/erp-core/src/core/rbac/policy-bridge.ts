import type { RequestedBy } from "../application/commands/requested-by.js";

import type { Grant } from "./domain/grant.js";
import { PermissionSet } from "./domain/permission-set.js";

/**
 * Projects an actor's RBAC facts into flat {@link PolicyContext}-style fields so
 * a declarative gate policy can reason over them (ABAC) — without importing the
 * policy engine or `zod`. It only builds a plain object; the consumer merges it
 * into `seed.fields` of `PolicyService.evaluate(...)`.
 *
 * The grants are filtered to `actor` first, so passing an actor's full grant
 * list (or a mixed one) is safe.
 *
 * **Wildcards are projected literally — they are NOT expanded.** `actor.roles`
 * and `actor.permissions` are the exact stored strings, so a permission such as
 * `"orders:*"` or `"*:*"` appears verbatim. A gate condition like
 * `{ field: "actor.permissions", op: "in", value: "orders:cancel" }` does a
 * *literal* membership test and will therefore NOT match a holder of
 * `"orders:*"`. Open-ended wildcards cannot be enumerated into a finite list, so
 * for wildcard-aware checks either match on the finite `actor.roles` instead, or
 * make the wildcard-aware decision with `RbacAuthorizer` (which knows
 * {@link Permission.implies}) and use the gate only for the extra ABAC
 * conditions.
 *
 * @returns `{ "actor.id", "actor.roles", "actor.permissions" }`, where roles and
 *   permissions are plain string arrays (wildcards left literal).
 */
export function rbacContextFields(
    actor: RequestedBy,
    grants: readonly Grant[],
): Record<string, unknown> {
    const set = PermissionSet.fromGrants(
        grants.filter((grant) => grant.appliesTo(actor)),
    );

    return {
        "actor.id": actor.raw,
        "actor.roles": [...set.roleNames],
        "actor.permissions": set
            .toArray()
            .map((permission) => permission.toPrimitive()),
    };
}
