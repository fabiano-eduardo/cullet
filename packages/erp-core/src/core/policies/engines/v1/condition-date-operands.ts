// Pure helpers for treating condition operands as instants. Extracted from
// condition-evaluator.ts to keep that file under the kit's size limit and to
// isolate the (zod-free) date logic the ./abac subpath re-uses. Import the date
// util directly (not the utils barrel): the barrel re-exports PolicyHashing,
// whose node:crypto import would needlessly drag a Node-only API into the
// zod-free ./abac subpath.
import { PolicyDateUtils } from "../../utils/date.js";
import { Result } from "../../../result/result.js";

import type { ConditionOp } from "./condition-types.js";

export type RelationalOperator = Extract<
    ConditionOp,
    "gt" | "gte" | "lt" | "lte"
>;

/**
 * The one instant format condition date operands may use. Strict on purpose
 * (UTC, milliseconds) so comparisons are unambiguous across time zones — and
 * so a malformed operand fails loudly instead of comparing wrong.
 */
export const CANONICAL_UTC_DATE_FORMAT = "YYYY-MM-DDTHH:mm:ss.SSSZ";

const ISO_8601_UTC_DATE_PATTERN =
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
// A value that is clearly meant to be a date-time but isn't canonical UTC
// (missing milliseconds, a non-UTC offset, a space separator…). Lets the
// caller report a "malformed date" error instead of a misleading "not a
// number" one.
const ISO_8601_DATE_LIKE_PATTERN = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/;

/**
 * Parses a value used as a date operand:
 * - `Result.ok(Date)` for a valid Date or a canonical ISO-8601 UTC string;
 * - `Result.err` when it is date-shaped but malformed (invalid Date, or a
 *   date-like string that isn't canonical UTC) — a configuration error worth
 *   surfacing rather than silently treating as "not a date";
 * - `null` when the value isn't date-shaped at all, so the caller can fall
 *   through to a numeric comparison.
 */
export function parseComparableDate(
    value: unknown,
): Result<Date, string> | null {
    if (value instanceof Date) {
        return PolicyDateUtils.isValid(value)
            ? Result.ok(value)
            : Result.err("Invalid Date instance");
    }

    if (typeof value !== "string") {
        return null;
    }

    if (ISO_8601_UTC_DATE_PATTERN.test(value)) {
        const parsed = new Date(value);
        if (
            !PolicyDateUtils.isValid(parsed) ||
            parsed.toISOString() !== value
        ) {
            return Result.err("Invalid ISO 8601 UTC date string");
        }

        return Result.ok(parsed);
    }

    if (ISO_8601_DATE_LIKE_PATTERN.test(value)) {
        return Result.err(
            `date operand must be canonical ISO 8601 UTC (${CANONICAL_UTC_DATE_FORMAT})`,
        );
    }

    return null;
}

export function evaluateRelationalNumbers(
    actual: number,
    op: RelationalOperator,
    expected: number,
): boolean {
    switch (op) {
        case "gt":
            return actual > expected;
        case "gte":
            return actual >= expected;
        case "lt":
            return actual < expected;
        case "lte":
            return actual <= expected;
    }
}

export function containsInvalidDate(value: unknown): boolean {
    if (value instanceof Date) {
        return !PolicyDateUtils.isValid(value);
    }
    if (Array.isArray(value)) {
        return value.some((item) => containsInvalidDate(item));
    }
    return false;
}

// Valid Dates become their ISO string so equality/set operators compare
// instants instead of references; every other value passes through.
export function normalizeDateOperand(value: unknown): unknown {
    if (value instanceof Date) {
        return value.toISOString();
    }
    if (Array.isArray(value)) {
        return value.map((item) => normalizeDateOperand(item));
    }
    return value;
}
