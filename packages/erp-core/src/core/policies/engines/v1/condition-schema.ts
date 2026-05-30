import { z } from "zod";

import type { ConditionLeafNode, ConditionNode } from "./condition-types";

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

export const conditionNodeSchema: z.ZodType<ConditionNode> = z.lazy(() =>
  z.union([
    conditionLeafNodeSchema,
    z
      .object({
        and: z.array(conditionNodeSchema).min(1),
      })
      .strict(),
    z
      .object({
        or: z.array(conditionNodeSchema).min(1),
      })
      .strict(),
    z
      .object({
        not: conditionNodeSchema,
      })
      .strict(),
  ]),
);
