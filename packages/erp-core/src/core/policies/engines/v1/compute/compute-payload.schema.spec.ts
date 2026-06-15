import { describe, expect, it } from "vitest";

import { ComputePayloadSchemaV1 } from "./compute-payload.schema.js";

describe("parseComputePayload (v1)", () => {
    describe("params pattern", () => {
        it("accepts a valid params payload", () => {
            const payload = {
                type: "params",
                data: { fineRate: 0.015, gracePeriodDays: 3, cap: 0.2 },
            };

            const result = ComputePayloadSchemaV1.parse(payload);

            expect(result.isOk()).toBe(true);
            expect(result.getOrNull()).toMatchObject({
                type: "params",
                data: { fineRate: 0.015 },
            });
        });

        it("rejects a payload with an invalid type", () => {
            const result = ComputePayloadSchemaV1.parse({
                type: "unknown",
                data: {},
            });

            expect(result.isErr()).toBe(true);
            expect(result.errorOrNull()).toContain("Invalid compute payload");
        });

        it("rejects a params payload missing the data field", () => {
            const result = ComputePayloadSchemaV1.parse({ type: "params" });

            expect(result.isErr()).toBe(true);
            expect(result.errorOrNull()).toContain("Invalid compute payload");
        });

        it("rejects a payload that is not an object", () => {
            const result = ComputePayloadSchemaV1.parse(null);

            expect(result.isErr()).toBe(true);
            expect(result.errorOrNull()).toContain("Invalid compute payload");
        });
    });

    describe("decision-table pattern", () => {
        it("accepts a decision-table payload with a valid ConditionNode", () => {
            const payload = {
                type: "decision-table",
                rules: [
                    {
                        conditions: {
                            and: [
                                {
                                    field: "amount",
                                    op: "gte",
                                    value: 1000,
                                    allowNull: true,
                                },
                                { field: "status", op: "eq", value: "ACTIVE" },
                            ],
                        },
                        result: "premium",
                    },
                    {
                        conditions: { field: "amount", op: "gte", value: 500 },
                        result: "standard",
                    },
                ],
                default: "basic",
            };

            const result = ComputePayloadSchemaV1.parse(payload);

            expect(result.isOk()).toBe(true);
        });

        it("rejects a decision-table with an invalid op in conditions", () => {
            const payload = {
                type: "decision-table",
                rules: [
                    {
                        conditions: {
                            field: "amount",
                            op: "equals",
                            value: 100,
                        },
                        result: "high",
                    },
                ],
                default: "low",
            };

            const result = ComputePayloadSchemaV1.parse(payload);

            expect(result.isErr()).toBe(true);
            expect(result.errorOrNull()).toContain("Invalid compute payload");
        });

        it("rejects allowNull set to false in conditions", () => {
            const payload = {
                type: "decision-table",
                rules: [
                    {
                        conditions: {
                            field: "amount",
                            op: "gte",
                            value: 100,
                            allowNull: false,
                        },
                        result: "high",
                    },
                ],
                default: "low",
            };

            const result = ComputePayloadSchemaV1.parse(payload);

            expect(result.isErr()).toBe(true);
            expect(result.errorOrNull()).toContain("Invalid compute payload");
        });

        it("rejects a decision-table with an empty rules array", () => {
            const payload = {
                type: "decision-table",
                rules: [],
                default: "low",
            };

            const result = ComputePayloadSchemaV1.parse(payload);

            expect(result.isErr()).toBe(true);
        });

        it("accepts a decision-table with a nested ConditionNode (not)", () => {
            const payload = {
                type: "decision-table",
                rules: [
                    {
                        conditions: {
                            not: { field: "blocked", op: "eq", value: true },
                        },
                        result: 42,
                    },
                ],
                default: null,
            };

            const result = ComputePayloadSchemaV1.parse(payload);

            expect(result.isOk()).toBe(true);
        });

        it("accepts a decision-table with an ISO UTC value for a date comparison", () => {
            const payload = {
                type: "decision-table",
                rules: [
                    {
                        conditions: {
                            field: "charge.dueDate",
                            op: "lt",
                            value: "2026-02-01T00:00:00.000Z",
                        },
                        result: "before-deadline",
                    },
                ],
                default: "after-deadline",
            };

            const result = ComputePayloadSchemaV1.parse(payload);

            expect(result.isOk()).toBe(true);
        });
    });
});
