import { ValidationCode } from "../../exceptions/validation-code.js";
import { InvalidValueException } from "../../exceptions/validation-exception.js";
import { ValidationField } from "../../exceptions/validation-field.js";
import { ValueObject } from "../../domain/value-object.js";

import { Permission } from "./permission.js";

/**
 * The serializable shape of a role: a name plus its permissions kept as their
 * primitive `"resource:action"` strings (so the role round-trips through JSON
 * and stays deep-frozen). The {@link Role.permissions} getter rehydrates them
 * back into {@link Permission} objects.
 */
type RoleProps = {
    readonly name: string;
    readonly permissions: readonly string[];
};

const ROLE_FIELD = ValidationField.of("role");

/**
 * A named bundle of {@link Permission}s — `"cashier"`, `"manager"`, `"admin"`.
 * There is **no role hierarchy** in v1: a role grants exactly the permissions
 * it lists (wildcards included). Duplicate permissions are collapsed on
 * construction, preserving first-seen order.
 *
 * A zod-free value object. Build through {@link of}; reconstruct a serialized
 * one through {@link fromProps}.
 */
class Role extends ValueObject<RoleProps, RoleProps> {
    // Parsed once, at construction, and cached: the decisor calls `grants` (and
    // `PermissionSet` reads `permissions`) repeatedly, so re-parsing the stored
    // strings on every access would be wasted work.
    private readonly _permissions: readonly Permission[];

    private constructor(props: RoleProps) {
        super(props);
        this._permissions = this.value.permissions.map(Permission.of);
        this.finalize();
    }

    /**
     * Builds a role from a name and its permissions. Throws
     * {@link InvalidValueException} when the name is blank. Duplicate
     * permissions are deduplicated.
     */
    static of(name: string, permissions: readonly Permission[]): Role {
        if (typeof name !== "string" || name.trim().length === 0) {
            throw new InvalidValueException(
                ROLE_FIELD,
                ValidationCode.BLANK,
                `role name must be a non-empty string, got "${name}"`,
            );
        }

        const seen = new Set<string>();
        const deduped: string[] = [];
        for (const permission of permissions) {
            const primitive = permission.toPrimitive();
            if (seen.has(primitive)) continue;
            seen.add(primitive);
            deduped.push(primitive);
        }

        return new Role({ name, permissions: deduped });
    }

    /**
     * Rebuilds a role from its serialized {@link RoleProps} — the inverse of
     * {@link toPrimitive}. Each stored string is re-parsed through
     * {@link Permission.of}, so a malformed payload still fails loudly.
     */
    static fromProps(props: RoleProps): Role {
        return Role.of(props.name, props.permissions.map(Permission.of));
    }

    get name(): string {
        return this.value.name;
    }

    /** The role's permissions, rehydrated from their stored primitive form. */
    get permissions(): readonly Permission[] {
        return this._permissions;
    }

    /** Whether any permission in this role {@link Permission.implies | implies} `required`. */
    grants(required: Permission): boolean {
        return this._permissions.some((permission) =>
            permission.implies(required),
        );
    }

    toPrimitive(): RoleProps {
        return {
            name: this.value.name,
            permissions: [...this.value.permissions],
        };
    }
}

export { Role, type RoleProps };
