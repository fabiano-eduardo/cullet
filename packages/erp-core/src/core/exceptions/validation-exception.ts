import { DomainException } from "./domain-exception.js";
import { InvariantViolationException } from "./invariant-violation-exception.js";
import { ValidationCode } from "./validation-code.js";
import { ValidationField } from "./validation-field.js";

export interface ValidationViolation {
    readonly field: ValidationField;
    readonly code: ValidationCode;
    readonly message: string;
}

// Extensible base for a single-field validation failure. Prefer throwing the
// concrete InvalidValueException below so callers can `instanceof` the common
// case; extend this directly only when you need a distinct validation subtype.
class ValidationException extends DomainException {
    constructor(
        public readonly field: ValidationField,
        public readonly code: ValidationCode,
        message: string,
        options?: { cause?: unknown },
    ) {
        super(message, options);
    }
}

// Carries multiple validation violations from a single operation (e.g. bulk validation).
// Use when you need to report all field errors at once rather than failing on the first.
class MultipleValidationException extends DomainException {
    constructor(
        public readonly violations: readonly ValidationViolation[],
        options?: { cause?: unknown },
    ) {
        // An aggregate with no violations is a caller bug: it produces a
        // messageless, contentless exception. Fail fast as a broken invariant.
        if (violations.length === 0) {
            throw new InvariantViolationException(
                "MultipleValidationException requires at least one violation.",
            );
        }
        super(violations.map((v) => v.message).join("; "), options);
    }

    // Number of accumulated violations (always >= 1).
    get count(): number {
        return this.violations.length;
    }

    // The first accumulated violation.
    get first(): ValidationViolation {
        return this.violations[0];
    }

    // Violations targeting the given field.
    byField(field: ValidationField): readonly ValidationViolation[] {
        return this.violations.filter((v) => v.field.equals(field));
    }
}

// The canonical concrete validation exception, thrown across the domain
// (rbac/abac/policies/commands) when a single input value is invalid. Its
// identity is exactly that: the named, catchable "a value was invalid" case,
// versus ValidationException as the open base.
class InvalidValueException extends ValidationException {
    constructor(
        field: ValidationField,
        code: ValidationCode,
        message: string,
        options?: { cause?: unknown },
    ) {
        super(field, code, message, options);
    }
}

export {
    InvalidValueException,
    MultipleValidationException,
    ValidationException,
};
