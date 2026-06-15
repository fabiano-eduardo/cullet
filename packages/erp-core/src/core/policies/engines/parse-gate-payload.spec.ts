import { describe, expect, it } from "vitest";

import { Result } from "../../result/result.js";

import {
    GatePayloadParsers,
    GatePayloadParserRegistry,
} from "./parse-gate-payload.js";

describe("GatePayloadParserRegistry", () => {
    it("allows registering parsers dynamically per engine version", () => {
        const registry = new GatePayloadParserRegistry();

        registry.register(2, () =>
            Result.ok({
                condition: {
                    field: "student.status",
                    op: "eq",
                    value: "ACTIVE",
                },
            }),
        );

        const result = registry.parse(2, { custom: true });

        expect(result.isOk()).toBe(true);
        expect(result.getOrNull()).toEqual({
            condition: {
                field: "student.status",
                op: "eq",
                value: "ACTIVE",
            },
        });
    });

    it("mantem o parser v1 registrado no dispatcher padrao", () => {
        const result = GatePayloadParsers.parse(1, {
            condition: {
                field: "student.status",
                op: "eq",
                value: "ACTIVE",
            },
        });

        expect(result.isOk()).toBe(true);
    });

    it("allows dynamic extension on the default dispatcher", () => {
        GatePayloadParsers.register(99, () =>
            Result.ok({
                condition: {
                    field: "student.segment",
                    op: "eq",
                    value: "VIP",
                },
            }),
        );

        const result = GatePayloadParsers.parse(99, { experimental: true });

        expect(result.isOk()).toBe(true);
        expect(result.getOrNull()).toEqual({
            condition: {
                field: "student.segment",
                op: "eq",
                value: "VIP",
            },
        });
    });
});
