import { ValidationCode } from "../../exceptions/validation-code.js";
import { InvalidValueException } from "../../exceptions/validation-exception.js";
import { ValidationField } from "../../exceptions/validation-field.js";
import { ValueObject } from "../../domain/value-object.js";
import type {
    ConditionNode,
    ConditionOp,
} from "../../policies/engines/v1/condition-types.js";

/** Whether a matching {@link AbacRule} permits or denies the action. */
type RuleEffect = "PERMIT" | "DENY";

/**
 * The serializable shape of a rule: a stable `id`/`version` (surfaced on a
 * denial as `policyId`/`policyVersion`), the {@link RuleEffect}, and the
 * {@link ConditionNode} that decides whether the rule applies to a request's
 * flattened attributes.
 */
type AbacRuleProps = {
    readonly id: string;
    readonly version: number;
    readonly effect: RuleEffect;
    readonly condition: ConditionNode;
    readonly description?: string;
};

const RULE_FIELD = ValidationField.of("abacRule");

const CONDITION_OPS = new Set<ConditionOp>([
    "eq",
    "neq",
    "gt",
    "gte",
    "lt",
    "lte",
    "in",
    "notIn",
    "isNull",
    "isNotNull",
]);

const RULE_EFFECTS = new Set<RuleEffect>(["PERMIT", "DENY"]);

function isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * A single attribute-based rule: an {@link RuleEffect} that takes hold when its
 * {@link ConditionNode} matches the request's flattened attributes. The
 * condition reuses the gate/compute condition DSL (`{ field, op, value }` leaves
 * combined with `and`/`or`/`not`), so a consumer learns one condition language
 * across the whole kit.
 *
 * A zod-free value object: it validates its own shape on construction (throwing
 * {@link InvalidValueException}) and is deep-frozen thereafter. Because rules are
 * authored in TypeScript — trusted data, not untrusted JSON — the structural
 * check is a hand-rolled walk of the condition tree rather than a schema parse.
 * Build one through {@link of}; the constructor is private.
 */
class AbacRule extends ValueObject<AbacRuleProps, AbacRuleProps> {
    private constructor(props: AbacRuleProps) {
        super(props);
        this.finalize();
    }

    /**
     * Builds a rule, validating that `id` is non-blank, `version` is an integer
     * ≥ 1, `effect` is `"PERMIT"`/`"DENY"`, and `condition` is a well-formed
     * condition node. Throws {@link InvalidValueException} otherwise.
     */
    static of(props: AbacRuleProps): AbacRule {
        if (typeof props.id !== "string" || props.id.trim().length === 0) {
            throw new InvalidValueException(
                RULE_FIELD.nested("id"),
                ValidationCode.BLANK,
                `abac rule id must be a non-empty string, got "${props.id}"`,
            );
        }

        if (!Number.isInteger(props.version) || props.version < 1) {
            throw new InvalidValueException(
                RULE_FIELD.nested("version"),
                ValidationCode.OUT_OF_RANGE,
                `abac rule version must be an integer >= 1, got "${props.version}"`,
            );
        }

        if (!RULE_EFFECTS.has(props.effect)) {
            throw new InvalidValueException(
                RULE_FIELD.nested("effect"),
                ValidationCode.INVALID_FORMAT,
                `abac rule effect must be "PERMIT" or "DENY", got "${String(props.effect)}"`,
            );
        }

        AbacRule.assertConditionShape(props.condition);

        return new AbacRule(props);
    }

    // Mirrors what the shared condition evaluator would reject at eval time
    // (empty and/or nodes, malformed leaves) but fails fast at construction.
    private static assertConditionShape(node: unknown): void {
        if (!isPlainObject(node)) {
            AbacRule.rejectCondition(
                "abac rule condition must be a leaf { field, op } or an { and | or | not } node",
            );
        }

        if ("and" in node || "or" in node) {
            const key = "and" in node ? "and" : "or";
            const children = node[key];
            if (!Array.isArray(children) || children.length === 0) {
                AbacRule.rejectCondition(
                    `abac rule "${key}" node must hold a non-empty array of child conditions`,
                );
            }
            for (const child of children) {
                AbacRule.assertConditionShape(child);
            }
            return;
        }

        if ("not" in node) {
            AbacRule.assertConditionShape(node.not);
            return;
        }

        if ("field" in node && "op" in node) {
            if (
                typeof node.field !== "string" ||
                node.field.trim().length === 0
            ) {
                AbacRule.rejectCondition(
                    `abac rule condition leaf "field" must be a non-empty string, got "${String(node.field)}"`,
                );
            }
            if (
                typeof node.op !== "string" ||
                !CONDITION_OPS.has(node.op as ConditionOp)
            ) {
                AbacRule.rejectCondition(
                    `abac rule condition leaf "op" is not a supported operator, got "${String(node.op)}"`,
                );
            }
            return;
        }

        AbacRule.rejectCondition(
            "abac rule condition must be a leaf { field, op } or an { and | or | not } node",
        );
    }

    private static rejectCondition(message: string): never {
        throw new InvalidValueException(
            RULE_FIELD.nested("condition"),
            ValidationCode.INVALID_FORMAT,
            message,
        );
    }

    get id(): string {
        return this.value.id;
    }

    get version(): number {
        return this.value.version;
    }

    get effect(): RuleEffect {
        return this.value.effect;
    }

    /** The condition tree evaluated against a request's flattened attributes. */
    get condition(): ConditionNode {
        return this.value.condition as ConditionNode;
    }

    get description(): string | undefined {
        return this.value.description;
    }

    toPrimitive(): AbacRuleProps {
        return {
            id: this.value.id,
            version: this.value.version,
            effect: this.value.effect,
            condition: this.value.condition as ConditionNode,
            ...(this.value.description !== undefined
                ? { description: this.value.description }
                : {}),
        };
    }
}

export { AbacRule, type AbacRuleProps, type RuleEffect };
