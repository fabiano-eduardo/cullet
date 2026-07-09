import { ValidationCode } from "../../exceptions/validation-code.js";
import { InvalidValueException } from "../../exceptions/validation-exception.js";
import { ValidationField } from "../../exceptions/validation-field.js";

import { Permission } from "./permission.js";

/** The input shape: each resource maps to the actions it supports. */
type CatalogShape = Record<string, readonly string[]>;

/** Nested `Permission` lookup mirroring the catalog: `permissions.orders.cancel`. */
type CatalogPermissions<C extends CatalogShape> = {
    readonly [R in keyof C]: {
        readonly [A in C[R][number] & string]: Permission;
    };
};

/** Union of exactly the `"resource:action"` pairs declared — not the cross product. */
type CatalogPermissionString<C extends CatalogShape> = {
    [R in keyof C]: `${R & string}:${C[R][number] & string}`;
}[keyof C];

/** What {@link definePermissionCatalog} returns. */
interface PermissionCatalog<C extends CatalogShape> {
    /** Typed lookup for use cases: a mistyped resource or action fails to compile. */
    readonly permissions: CatalogPermissions<C>;
    /** Every declared permission string — for validating seeds/DB rows against the catalog. */
    readonly all: readonly CatalogPermissionString<C>[];
}

const CATALOG_FIELD = ValidationField.of("permissionCatalog");

/**
 * Builds a project's canonical permission catalog from a plain
 * `{ resource: [actions] }` literal, so each verb is written exactly once and
 * both the compile-time type and the runtime {@link Permission} objects derive
 * from it:
 *
 * ```ts
 * const { permissions, all } = definePermissionCatalog({
 *     orders: ["read", "create", "cancel"],
 *     invoices: ["read", "issue"],
 * });
 * permissions.orders.cancel;          // Permission "orders:cancel"
 * permissions.orders.cancell;         // compile error
 * type PermissionString = (typeof all)[number];
 * ```
 *
 * Each entry is validated by {@link Permission.for} at construction (import
 * time), so a malformed segment fails loud before any decision runs. Wildcards
 * are rejected outright: the catalog is the *required* side of RBAC, and a
 * required permission may never wildcard — only granted roles may.
 */
function definePermissionCatalog<const C extends CatalogShape>(
    catalog: C,
): PermissionCatalog<C> {
    const permissions = Object.fromEntries(
        Object.entries(catalog).map(([resource, actions]) => [
            resource,
            Object.freeze(
                Object.fromEntries(
                    actions.map((action) => [
                        action,
                        buildConcrete(resource, action),
                    ]),
                ),
            ),
        ]),
    ) as CatalogPermissions<C>;

    const all = Object.entries(catalog).flatMap(([resource, actions]) =>
        actions.map((action) => `${resource}:${action}`),
    ) as CatalogPermissionString<C>[];

    return Object.freeze({
        permissions: Object.freeze(permissions),
        all: Object.freeze(all),
    });
}

function buildConcrete(resource: string, action: string): Permission {
    const permission = Permission.for(resource, action);
    if (permission.hasWildcard()) {
        throw new InvalidValueException(
            CATALOG_FIELD.nested(resource),
            ValidationCode.INVALID_FORMAT,
            `catalog permissions must be concrete — a required permission may never wildcard, got "${permission.toPrimitive()}"`,
        );
    }
    return permission;
}

export { definePermissionCatalog, type PermissionCatalog };
