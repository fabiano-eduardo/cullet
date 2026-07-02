import { ValidationCode } from "../../exceptions/validation-code.js";
import { InvalidValueException } from "../../exceptions/validation-exception.js";
import { ValidationField } from "../../exceptions/validation-field.js";
import { ValueObject } from "../../domain/value-object.js";

/** The two halves of a permission: what is acted on, and what is done to it. */
type PermissionProps = {
    readonly resource: string;
    readonly action: string;
};

const PERMISSION_FIELD = ValidationField.of("permission");

// A segment is either a whole-segment wildcard (`*`) or a run of lowercase
// alphanumerics, hyphens and underscores. Partial wildcards (`ord*`) are
// rejected on purpose: a `*` only ever stands for an entire segment.
const SEGMENT_PATTERN = /^(?:\*|[a-z0-9_-]+)$/u;

/**
 * A `"<resource>:<action>"` capability such as `"orders:cancel"`, with a
 * single-level wildcard. Either segment may be the whole-segment wildcard `*`
 * (`"orders:*"`, `"*:cancel"`, `"*:*"`), which is what lets a broad grant cover
 * a narrower requirement — see {@link implies}.
 *
 * A zod-free value object: it validates its own format on construction
 * (throwing {@link InvalidValueException}) and is frozen thereafter. Build one
 * through {@link of} (from a raw `"resource:action"` string) or {@link for}
 * (from already-separated parts); the constructor is private.
 */
class Permission extends ValueObject<PermissionProps, string> {
    private constructor(props: PermissionProps) {
        super(props);
        this.finalize();
    }

    /**
     * Parses a `"resource:action"` string. Throws {@link InvalidValueException}
     * when the string is blank, lacks exactly one `:`, or carries an invalid
     * segment.
     */
    static of(raw: string): Permission {
        if (typeof raw !== "string" || raw.trim().length === 0) {
            throw new InvalidValueException(
                PERMISSION_FIELD,
                ValidationCode.BLANK,
                `permission must be a non-empty "resource:action" string, got "${raw}"`,
            );
        }

        const parts = raw.split(":");
        if (parts.length !== 2) {
            throw new InvalidValueException(
                PERMISSION_FIELD,
                ValidationCode.INVALID_FORMAT,
                `permission must have exactly one ":" separating resource and action, got "${raw}"`,
            );
        }

        return Permission.for(parts[0], parts[1]);
    }

    /**
     * Builds from already-separated `resource` and `action` parts. Each must be
     * a valid segment (`[a-z0-9_-]+` or the whole-segment wildcard `*`).
     */
    static for(resource: string, action: string): Permission {
        Permission.assertSegment(resource, "resource");
        Permission.assertSegment(action, "action");
        return new Permission({ resource, action });
    }

    private static assertSegment(
        value: string,
        label: "resource" | "action",
    ): void {
        if (typeof value !== "string" || !SEGMENT_PATTERN.test(value)) {
            throw new InvalidValueException(
                PERMISSION_FIELD.nested(label),
                ValidationCode.INVALID_FORMAT,
                `permission ${label} must match [a-z0-9_-]+ or be the whole-segment wildcard "*" (no partial wildcards), got "${value}"`,
            );
        }
    }

    get resource(): string {
        return this.value.resource;
    }

    get action(): string {
        return this.value.action;
    }

    /**
     * Whether holding this permission grants `other`. A `*` segment matches any
     * value in the same position, so `"orders:*"` implies `"orders:cancel"` and
     * `"*:*"` implies everything. Concrete segments must match exactly.
     */
    implies(other: Permission): boolean {
        return (
            (this.resource === "*" || this.resource === other.resource) &&
            (this.action === "*" || this.action === other.action)
        );
    }

    /**
     * Whether either segment is the whole-segment wildcard `*`. A *granted*
     * permission may wildcard (see {@link implies}); a *required* one may not —
     * `RbacAuthorizer` rejects a wildcard requirement as caller misuse.
     */
    hasWildcard(): boolean {
        return this.value.resource === "*" || this.value.action === "*";
    }

    toPrimitive(): string {
        return `${this.value.resource}:${this.value.action}`;
    }
}

export { Permission, type PermissionProps };
