import { describe, expect, it } from "vitest";

import {
    asSchoolId,
    asTenantId,
    type SchoolId,
    type TenantId,
} from "../policy-ids.js";
import { ContextSeedValidator } from "./context-seed.js";

function unsafeTenantId(value: string): TenantId {
    return value as TenantId;
}

function unsafeSchoolId(value: string): SchoolId {
    return value as SchoolId;
}

describe("validateContextSeed", () => {
    it("rejects an empty tenantId", () => {
        const result = ContextSeedValidator.validate({
            tenantId: unsafeTenantId("   "),
            schoolId: asSchoolId("school-1"),
            fields: {},
        });

        expect(result.isErr()).toBe(true);
        expect(result.errorOrNull()).toBe(
            "ContextSeed tenantId must be a non-empty string",
        );
    });

    it("rejects an empty schoolId", () => {
        const result = ContextSeedValidator.validate({
            tenantId: asTenantId("tenant-1"),
            schoolId: unsafeSchoolId(""),
            fields: {},
        });

        expect(result.isErr()).toBe(true);
        expect(result.errorOrNull()).toBe(
            "ContextSeed schoolId must be a non-empty string",
        );
    });

    it("accepts non-empty ids", () => {
        const seed = {
            tenantId: asTenantId("tenant-1"),
            schoolId: asSchoolId("school-1"),
            fields: {},
        };

        const result = ContextSeedValidator.validate(seed);

        expect(result.isOk()).toBe(true);
        expect(result.getOrNull()).toBe(seed);
    });
});
