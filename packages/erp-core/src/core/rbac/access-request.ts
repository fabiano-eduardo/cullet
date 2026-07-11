import type { RequestedBy } from "../application/commands/requested-by.js";

import type { Permission } from "./domain/permission.js";
import type { Scope } from "./domain/scope.js";

/**
 * The question put to the {@link RbacAuthorizer}: *may this actor perform this
 * action on this resource, in this scope?* Carries the audit-friendly business
 * `action` label alongside the concrete {@link Permission} it requires, and
 * references the target by type/id only (never the full payload).
 */
interface AccessRequest {
    /** Who is acting — reused as the RBAC subject, no separate `Actor` type. */
    readonly actor: RequestedBy;

    /** Stable business action for auditing, e.g. `"order.cancel"`. */
    readonly action: string;

    /**
     * The permission the action requires, e.g. `Permission.of("orders:cancel")`.
     * Never a wildcard — only the *granted* permissions on roles may wildcard.
     */
    readonly required: Permission;

    /**
     * The target resource, identified without leaking its payload. Carried for
     * audit metadata only — the RBAC decisor does **not** check it. Per-resource
     * ownership (this actor may cancel *this* order) is an ABAC/policy concern,
     * not a role/permission one.
     */
    readonly resource?: { readonly type: string; readonly id?: string };

    /**
     * The scope the resource lives in, e.g. `Scope.of("school:123")`. Asking in
     * the global scope (`Scope.global()`) means "may I do this *everywhere*?" and
     * so requires a globally-scoped grant — it is **not** "in any scope I happen
     * to hold". Ask about a concrete scope to check a bounded grant.
     */
    readonly scope: Scope;
}

export type { AccessRequest };
