import { RequestedBy } from "../../application/commands/requested-by.js";
import { ValueObject } from "../../domain/value-object.js";

import { Role, type RoleProps } from "./role.js";
import { Scope } from "./scope.js";

/**
 * The serializable shape a consumer persists and loads: the actor's identity
 * (`RequestedBy.raw`), the role they hold (as {@link RoleProps}), and the scope
 * the role applies in (the {@link Scope} string).
 */
type GrantProps = {
    readonly subject: string;
    readonly role: RoleProps;
    readonly scope: string;
};

/**
 * A role binding — it ties one actor to one {@link Role} within one
 * {@link Scope}. This is the unit the consumer stores (a `(subject, role,
 * scope)` row) and rehydrates into the pure decisor; the kit itself persists
 * nothing.
 *
 * A zod-free value object built through {@link of} from live
 * `RequestedBy`/`Role`/`Scope` objects; the getters reconstruct those objects
 * back from the frozen primitive form.
 */
class Grant extends ValueObject<GrantProps, GrantProps> {
    // The live objects are rehydrated once, at construction, and cached — the
    // decisor reads `role`/`scope` at least once per grant, so parsing lazily on
    // each getter access would re-parse the same frozen primitives repeatedly.
    private readonly _subject: RequestedBy;
    private readonly _role: Role;
    private readonly _scope: Scope;

    private constructor(props: GrantProps) {
        super(props);
        this._subject = RequestedBy.parse(this.value.subject);
        this._role = Role.fromProps(this.value.role);
        this._scope = Scope.of(this.value.scope);
        this.finalize();
    }

    static of(params: {
        subject: RequestedBy;
        role: Role;
        scope: Scope;
    }): Grant {
        return new Grant({
            subject: params.subject.raw,
            role: params.role.toPrimitive(),
            scope: params.scope.toPrimitive(),
        });
    }

    /**
     * Rebuilds a grant from its serialized {@link GrantProps} — the inverse of
     * {@link toPrimitive}, symmetric to {@link Role.fromProps}. Each part is
     * re-validated (subject through {@link RequestedBy.parse}, role through
     * {@link Role.fromProps}, scope through {@link Scope.of}), so a malformed
     * payload still fails loudly.
     */
    static fromProps(props: GrantProps): Grant {
        return new Grant(props);
    }

    get subject(): RequestedBy {
        return this._subject;
    }

    get role(): Role {
        return this._role;
    }

    get scope(): Scope {
        return this._scope;
    }

    /** Whether this grant belongs to `actor`. */
    appliesTo(actor: RequestedBy): boolean {
        return this.value.subject === actor.raw;
    }

    toPrimitive(): GrantProps {
        return {
            subject: this.value.subject,
            role: {
                name: this.value.role.name,
                permissions: [...this.value.role.permissions],
            },
            scope: this.value.scope,
        };
    }
}

export { Grant, type GrantProps };
