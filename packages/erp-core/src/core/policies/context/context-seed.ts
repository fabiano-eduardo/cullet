import { Result } from "../../result/result.js";

import type { SchoolId, TenantId } from "../policy-ids.js";

/**
 * Seed data provided by the use case / caller.
 * Contains raw IDs and inputs that the context system will resolve into paths.
 * Each resolver is responsible for validating and extracting what it needs from fields.
 *
 * `tenantId`/`schoolId` are required on every seed, including evaluations scoped
 * at TENANT or GLOBAL level. The `schoolId`/`SCHOOL` vocabulary is deliberately
 * school-first: erp-core is a school ERP core, and a full-control copy targeting
 * another domain is expected to rename these ids to its own leaf scope.
 *
 * `fields` is an open bag, but two keys are reserved by the pipeline and carry
 * meaning beyond "just data":
 * - `now` (a `Date`) pins the evaluation clock;
 * - `asOf` (a `Date`) supplies the instant for `asOfSource: "CALLER_PROVIDED"`.
 * See {@link EvaluateInput} and {@link PolicyAsOfResolver}.
 */
export interface ContextSeed {
    readonly tenantId: TenantId;
    readonly schoolId: SchoolId;
    readonly fields: Record<string, unknown>;
}

export class ContextSeedValidator {
    private static isBlankSeedId(value: string): boolean {
        return value.trim().length === 0;
    }

    static validate(seed: ContextSeed): Result<ContextSeed, string> {
        if (ContextSeedValidator.isBlankSeedId(seed.tenantId)) {
            return Result.err(
                "ContextSeed tenantId must be a non-empty string",
            );
        }

        if (ContextSeedValidator.isBlankSeedId(seed.schoolId)) {
            return Result.err(
                "ContextSeed schoolId must be a non-empty string",
            );
        }

        return Result.ok(seed);
    }
}
