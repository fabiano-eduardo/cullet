import { z } from "zod";

import { Result } from "../../../../result/result.js";

import { conditionNodeSchema } from "../condition-schema.js";
import type { ConditionNode } from "../condition-types.js";

// ─── Pattern 1: Params ──────────────────────────────────────────────────────

export interface ComputeParamsPayload {
    readonly type: "params";
    readonly data: Readonly<Record<string, unknown>>;
}

// ─── Pattern 2: Decision table ──────────────────────────────────────────────

export interface ComputeDecisionTableRule<R = unknown> {
    readonly conditions: ConditionNode;
    readonly result: R;
}

export interface ComputeDecisionTablePayload<R = unknown> {
    readonly type: "decision-table";
    readonly rules: readonly ComputeDecisionTableRule<R>[];
    readonly default: R;
}

// ─── Union ──────────────────────────────────────────────────────────────────

export type ComputePayloadV1 =
    | ComputeDecisionTablePayload<unknown>
    | ComputeParamsPayload;

// ─── Zod schemas ────────────────────────────────────────────────────────────

const computeDecisionTableRuleSchema = z.object({
    conditions: conditionNodeSchema,
    result: z.unknown(),
});

export class ComputePayloadSchemaV1 {
    static readonly schema = z.union([
        z
            .object({
                type: z.literal("decision-table"),
                rules: z.array(computeDecisionTableRuleSchema).min(1),
                default: z.unknown(),
            })
            .strict(),
        z
            .object({
                type: z.literal("params"),
                data: z.record(z.string(), z.unknown()),
            })
            .strict(),
    ]);

    static parse(payload: unknown): Result<ComputePayloadV1, string> {
        const parsed = ComputePayloadSchemaV1.schema.safeParse(payload);
        if (!parsed.success) {
            const details = parsed.error.issues
                .map((issue) => {
                    const path = issue.path.join(".");
                    return path.length > 0
                        ? `${path}: ${issue.message}`
                        : issue.message;
                })
                .join("; ");

            return Result.err(`Invalid compute payload: ${details}`);
        }

        return Result.ok(parsed.data as ComputePayloadV1);
    }
}

export const computePayloadSchema = ComputePayloadSchemaV1.schema;
