import { DomainException } from "./domain-exception";
import { ValidationCode } from "./validation-code";
import { ValidationField } from "./validation-field";

export interface ValidationViolation {
    readonly field: ValidationField;
    readonly code: ValidationCode;
    readonly message: string;
}

class ValidationException extends DomainException {
    constructor(
        public readonly field: ValidationField,
        public readonly code: ValidationCode,
        message: string,
    ) {
        super(message);
    }
}

// Carries multiple validation violations from a single operation (e.g. bulk validation).
// Use when you need to report all field errors at once rather than failing on the first.
class MultipleValidationException extends DomainException {
    constructor(public readonly violations: readonly ValidationViolation[]) {
        super(violations.map((v) => v.message).join("; "));
    }
}

class InvalidValueException extends ValidationException {
    constructor(field: ValidationField, code: ValidationCode, message: string) {
        super(field, code, message);
    }
}

export {
    InvalidValueException,
    MultipleValidationException,
    ValidationException,
};
