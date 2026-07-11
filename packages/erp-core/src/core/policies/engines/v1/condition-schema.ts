import { z } from "zod";

import type { ConditionLeafNode, ConditionNode } from "./condition-types.js";

// ─── Shared v1 condition Zod schemas ─────────────────────────────────────────
// Extracted from gate/v1 so both gate/v1 and compute/v1 can validate
// condition nodes without either engine depending on the other.

const conditionOpSchema = z.enum([
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

export const conditionLeafNodeSchema: z.ZodType<ConditionLeafNode> = z
    .object({
        field: z.string().min(1),
        op: conditionOpSchema,
        value: z.unknown(),
        allowNull: z.literal(true).optional(),
    })
    .strict() as z.ZodType<ConditionLeafNode>;

// Cap nesting depth so an adversarially deep payload fails validation instead
// of overflowing the stack during parse: zod recurses once per level, and the
// old `z.lazy` schema was unbounded. The schema is built to exactly this depth
// (leaf-only past it), so a too-deep tree is rejected at the boundary without
// deep recursion. 32 is far beyond any hand-written policy — raise it only with
// a matching stack-safety review.
export const MAX_CONDITION_DEPTH = 32;

function boundedConditionNodeSchema(depth: number): z.ZodType<ConditionNode> {
    if (depth <= 1) {
        return conditionLeafNodeSchema;
    }

    const child = boundedConditionNodeSchema(depth - 1);
    return z.union([
        conditionLeafNodeSchema,
        z.object({ and: z.array(child).min(1) }).strict(),
        z.object({ or: z.array(child).min(1) }).strict(),
        z.object({ not: child }).strict(),
    ]) as z.ZodType<ConditionNode>;
}

export const conditionNodeSchema: z.ZodType<ConditionNode> =
    boundedConditionNodeSchema(MAX_CONDITION_DEPTH);
