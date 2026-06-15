import { describe, expect, it } from "vitest";

import { asSchoolId, asTenantId } from "../policy-ids.js";
import { PolicyAsOfResolver } from "./asof.js";

describe("deriveAsOf", () => {
    it("mantem o limite padrao de 10 anos no futuro", () => {
        const result = PolicyAsOfResolver.derive(
            "CALLER_PROVIDED",
            {
                tenantId: asTenantId("tenant-1"),
                schoolId: asSchoolId("school-1"),
                fields: {
                    asOf: new Date("2037-01-01T00:00:00.000Z"),
                },
            },
            new Date("2026-01-01T00:00:00.000Z"),
        );

        expect(result.isErr()).toBe(true);
        expect(result.errorOrNull()).toBe(
            "asOf date is more than 10 years in the future (received 2037-01-01T00:00:00.000Z)",
        );
    });

    it("accepts a future window configured by the caller", () => {
        const result = PolicyAsOfResolver.derive(
            "CALLER_PROVIDED",
            {
                tenantId: asTenantId("tenant-1"),
                schoolId: asSchoolId("school-1"),
                fields: {
                    asOf: new Date("2041-01-01T00:00:00.000Z"),
                },
            },
            new Date("2026-01-01T00:00:00.000Z"),
            {
                maxFutureYears: 20,
            },
        );

        expect(result.isOk()).toBe(true);
        expect(result.getOrNull()!.toISOString()).toBe(
            "2041-01-01T00:00:00.000Z",
        );
    });

    it("returns the provided now for asOfSource NOW", () => {
        const now = new Date("2026-01-01T00:00:00.000Z");
        const result = PolicyAsOfResolver.derive(
            "NOW",
            {
                tenantId: asTenantId("tenant-1"),
                schoolId: asSchoolId("school-1"),
                fields: {},
            },
            now,
        );

        expect(result.getOrNull()).toBe(now);
    });

    it("rejects CALLER_PROVIDED without a valid asOf date", () => {
        const result = PolicyAsOfResolver.derive(
            "CALLER_PROVIDED",
            {
                tenantId: asTenantId("tenant-1"),
                schoolId: asSchoolId("school-1"),
                fields: {},
            },
            new Date("2026-01-01T00:00:00.000Z"),
        );

        expect(result.isErr()).toBe(true);
        expect(result.errorOrNull()).toBe(
            'asOfSource "CALLER_PROVIDED" requires seed.fields.asOf to be a Date',
        );
    });

    it("rejects a negative maxFutureYears option", () => {
        const result = PolicyAsOfResolver.derive(
            "NOW",
            {
                tenantId: asTenantId("tenant-1"),
                schoolId: asSchoolId("school-1"),
                fields: {},
            },
            new Date("2026-01-01T00:00:00.000Z"),
            { maxFutureYears: -1 },
        );

        expect(result.isErr()).toBe(true);
        expect(result.errorOrNull()).toContain(
            "maxFutureYears must be a non-negative integer",
        );
    });

    it("rejects an unknown asOfSource", () => {
        const result = PolicyAsOfResolver.derive(
            "WHENEVER" as unknown as "NOW",
            {
                tenantId: asTenantId("tenant-1"),
                schoolId: asSchoolId("school-1"),
                fields: {},
            },
            new Date("2026-01-01T00:00:00.000Z"),
        );

        expect(result.isErr()).toBe(true);
        expect(result.errorOrNull()).toBe('Unknown asOfSource: "WHENEVER"');
    });
});
