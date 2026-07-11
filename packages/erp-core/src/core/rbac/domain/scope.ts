import { ValidationCode } from "../../exceptions/validation-code.js";
import { InvalidValueException } from "../../exceptions/validation-exception.js";
import { ValidationField } from "../../exceptions/validation-field.js";
import { ValueObject } from "../../domain/value-object.js";

/** The wrapped, already-validated scope string (`"type:id"` or `"*"`). */
type ScopeProps = { readonly raw: string };

const SCOPE_FIELD = ValidationField.of("scope");

// "type:id": a lowercase type segment, a colon, then a non-empty id. The id
// charset is permissive enough for UUIDs and numeric keys (`school:42`,
// `tenant:550e8400-e29b-41d4-a716-446655440000`).
const SCOPE_PATTERN = /^[a-z][a-z0-9_-]*:[A-Za-z0-9._-]+$/u;

/**
 * Where a grant (or a target resource) lives, aligned with
 * `AuthorizationRequirement.scope` and the policy `PolicyScope`
 * (`tenantId`/`schoolId`): `"tenant:{id}"`, `"school:{id}"`, or the global
 * `"*"`.
 *
 * v1 keeps containment ({@link includes}) flat — the global scope contains
 * everything, and any other scope contains only itself. A real hierarchy
 * (`tenant` ⊇ `school`) is a deliberately deferred extension point.
 */
class Scope extends ValueObject<ScopeProps, string> {
    private constructor(props: ScopeProps) {
        super(props);
        this.finalize();
    }

    /**
     * Validates `"type:id"` or the global `"*"`, throwing on anything else.
     * `Scope.of("*")` is accepted and is equivalent to {@link Scope.global} —
     * prefer `global()` at call-sites for intent, `of("*")` when rehydrating a
     * stored string.
     */
    static of(raw: string): Scope {
        if (typeof raw !== "string" || raw.trim().length === 0) {
            throw new InvalidValueException(
                SCOPE_FIELD,
                ValidationCode.BLANK,
                `scope must be a non-empty "type:id" string or "*", got "${raw}"`,
            );
        }

        if (raw !== "*" && !SCOPE_PATTERN.test(raw)) {
            throw new InvalidValueException(
                SCOPE_FIELD,
                ValidationCode.INVALID_FORMAT,
                `scope must be "type:id" (e.g. "school:42") or the global "*", got "${raw}"`,
            );
        }

        return new Scope({ raw });
    }

    /** The global scope `"*"`, which {@link includes} every other scope. */
    static global(): Scope {
        return new Scope({ raw: "*" });
    }

    /** The type segment, or `"*"` for the global scope. */
    get type(): string {
        if (this.value.raw === "*") return "*";
        return this.value.raw.slice(0, this.value.raw.indexOf(":"));
    }

    /** The id segment, or `undefined` for the global scope. */
    get id(): string | undefined {
        if (this.value.raw === "*") return undefined;
        return this.value.raw.slice(this.value.raw.indexOf(":") + 1);
    }

    /**
     * Whether this scope contains `target`. The global scope contains
     * everything; any other scope contains only an exact match of itself.
     */
    includes(target: Scope): boolean {
        if (this.value.raw === "*") return true;
        return this.value.raw === target.value.raw;
    }

    toPrimitive(): string {
        return this.value.raw;
    }
}

export { Scope, type ScopeProps };
