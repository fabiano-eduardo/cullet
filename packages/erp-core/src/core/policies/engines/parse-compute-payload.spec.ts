import { describe, expect, it } from "vitest";

import { Result } from "../../result/result.js";

import {
    ComputePayloadParsers,
    ComputePayloadParserRegistry,
} from "./parse-compute-payload.js";

describe("ComputePayloadParserRegistry", () => {
    it("allows registering parsers dynamically per schema version", () => {
        const registry = new ComputePayloadParserRegistry();

        registry.register(2, () =>
            Result.ok({
                type: "params",
                data: {
                    threshold: 10,
                },
            }),
        );

        const result = registry.parse(2, { custom: true });

        expect(result.isOk()).toBe(true);
        expect(result.getOrNull()).toEqual({
            type: "params",
            data: {
                threshold: 10,
            },
        });
    });

    it("mantem o parser v1 registrado no dispatcher padrao", () => {
        const result = ComputePayloadParsers.parse(1, {
            type: "params",
            data: {
                fineRate: 0.015,
                gracePeriodDays: 3,
            },
        });

        expect(result.isOk()).toBe(true);
    });

    it("allows dynamic extension on the default dispatcher", () => {
        ComputePayloadParsers.register(99, () =>
            Result.ok({
                type: "params",
                data: {
                    experimental: true,
                },
            }),
        );

        const result = ComputePayloadParsers.parse(99, {
            experimental: true,
        });

        expect(result.isOk()).toBe(true);
        expect(result.getOrNull()).toEqual({
            type: "params",
            data: {
                experimental: true,
            },
        });
    });
});
