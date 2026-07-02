import type { Grant } from "./grant.js";
import type { Permission } from "./permission.js";

/**
 * The flattened, deduplicated permissions an actor effectively holds across a
 * set of {@link Grant}s, together with the role names that contributed them.
 *
 * Pure resolution, isolated from the decisor so the "roles → permissions"
 * collapse can be tested on its own. Build through {@link fromGrants}; pre-filter
 * the grants to a single actor first when that matters (the set does not know
 * which actor it describes).
 */
class PermissionSet {
    private constructor(
        private readonly permissions: readonly Permission[],
        private readonly _roleNames: readonly string[],
    ) {}

    /**
     * Collapses the roles across `grants` into one permission set. Permissions
     * are deduplicated by their primitive form and role names by value, both
     * preserving first-seen order.
     */
    static fromGrants(grants: readonly Grant[]): PermissionSet {
        const permissions: Permission[] = [];
        const seenPermissions = new Set<string>();
        const roleNames: string[] = [];
        const seenRoles = new Set<string>();

        for (const grant of grants) {
            const role = grant.role;

            if (!seenRoles.has(role.name)) {
                seenRoles.add(role.name);
                roleNames.push(role.name);
            }

            for (const permission of role.permissions) {
                const primitive = permission.toPrimitive();
                if (seenPermissions.has(primitive)) continue;
                seenPermissions.add(primitive);
                permissions.push(permission);
            }
        }

        return new PermissionSet(permissions, roleNames);
    }

    /** Whether any held permission {@link Permission.implies | implies} `required`. */
    has(required: Permission): boolean {
        return this.permissions.some((permission) =>
            permission.implies(required),
        );
    }

    /** The effective permissions, deduplicated. */
    toArray(): readonly Permission[] {
        return this.permissions;
    }

    /** The names of the roles that contributed to this set, deduplicated. */
    get roleNames(): readonly string[] {
        return this._roleNames;
    }
}

export { PermissionSet };
