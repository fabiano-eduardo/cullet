import type { RequestedBy } from "../application/commands/requested-by.js";

/**
 * The attribute bags an ABAC decision reasons over, grouped by the four standard
 * categories. Each is a flat record; {@link abacContext} nests them under
 * `subject` / `resource` / `action` / `env` so a rule's condition can reference
 * fields like `resource.status` or `env.businessHours`.
 */
type AbacAttributes = {
    readonly subject?: Record<string, unknown>;
    readonly resource?: Record<string, unknown>;
    readonly action?: Record<string, unknown>;
    readonly environment?: Record<string, unknown>;
};

/**
 * The question put to the {@link AbacAuthorizer}: *do these attributes authorize
 * this action?* Carries the acting {@link RequestedBy} (reused as the subject),
 * an audit-friendly `action` label, an optional type/id resource reference, and
 * the {@link AbacAttributes} the rules evaluate.
 */
interface AbacRequest {
    readonly actor: RequestedBy;
    readonly action: string;
    readonly resource?: { readonly type: string; readonly id?: string };
    readonly attributes: AbacAttributes;
}

export type { AbacAttributes, AbacRequest };
