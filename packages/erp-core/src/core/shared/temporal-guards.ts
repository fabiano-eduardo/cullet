import { InvariantViolationException } from "../exceptions/invariant-violation-exception.js";

function isValidDate(value: unknown): value is Date {
    return value instanceof Date && !Number.isNaN(value.getTime());
}

function cloneDate(date: Date): Date {
    return new Date(date.getTime());
}

function assertValidDate(
    fieldName: string,
    value: unknown,
): asserts value is Date {
    if (!isValidDate(value)) {
        throw new InvariantViolationException(
            `${fieldName} must be a valid Date instance`,
        );
    }
}

export { assertValidDate, cloneDate, isValidDate };
