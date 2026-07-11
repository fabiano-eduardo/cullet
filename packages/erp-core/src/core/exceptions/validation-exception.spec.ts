import { describe, expect, it } from "vitest";

import { DomainException } from "./domain-exception.js";
import { InvariantViolationException } from "./invariant-violation-exception.js";
import { ValidationCode } from "./validation-code.js";
import { ValidationField } from "./validation-field.js";
import {
    InvalidValueException,
    MultipleValidationException,
    ValidationException,
    type ValidationViolation,
} from "./validation-exception.js";

describe("ValidationException", () => {
    const field = ValidationField.of("email");
    const code = ValidationCode.INVALID_FORMAT;

    describe("constructor", () => {
        it("stores field, code, and message", () => {
            const exception = new ValidationException(
                field,
                code,
                "invalid email format",
            );

            expect(exception.field).toBe(field);
            expect(exception.code).toBe(code);
            expect(exception.message).toBe("invalid email format");
        });

        it("accepts any ValidationCode", () => {
            const exception = new ValidationException(
                field,
                ValidationCode.REQUIRED,
                "required field",
            );

            expect(exception.code).toBe(ValidationCode.REQUIRED);
        });

        it("propagates the wrapped cause", () => {
            const cause = new Error("parse failed");
            const exception = new ValidationException(field, code, "msg", {
                cause,
            });

            expect(exception.cause).toBe(cause);
        });
    });

    describe("inheritance", () => {
        it("is an instance of DomainException", () => {
            const exception = new ValidationException(field, code, "msg");

            expect(exception).toBeInstanceOf(DomainException);
        });

        it("is an instance of ValidationException", () => {
            const exception = new ValidationException(field, code, "msg");

            expect(exception).toBeInstanceOf(ValidationException);
        });
    });
});

describe("InvalidValueException", () => {
    const field = ValidationField.of("cpf");
    const code = ValidationCode.INVALID_CHECKSUM;

    describe("constructor", () => {
        it("stores field, code, and message", () => {
            const exception = new InvalidValueException(
                field,
                code,
                "CPF has an invalid check digit",
            );

            expect(exception.field).toBe(field);
            expect(exception.code).toBe(code);
            expect(exception.message).toBe("CPF has an invalid check digit");
        });
    });

    describe("inheritance", () => {
        it("is an instance of ValidationException", () => {
            const exception = new InvalidValueException(field, code, "msg");

            expect(exception).toBeInstanceOf(ValidationException);
        });

        it("is an instance of DomainException", () => {
            const exception = new InvalidValueException(field, code, "msg");

            expect(exception).toBeInstanceOf(DomainException);
        });
    });
});

describe("MultipleValidationException", () => {
    const emailBlank: ValidationViolation = {
        field: ValidationField.of("email"),
        code: ValidationCode.BLANK,
        message: "email is blank",
    };
    const emailFormat: ValidationViolation = {
        field: ValidationField.of("email"),
        code: ValidationCode.INVALID_FORMAT,
        message: "email format is invalid",
    };
    const nameBlank: ValidationViolation = {
        field: ValidationField.of("name"),
        code: ValidationCode.BLANK,
        message: "name is blank",
    };

    describe("constructor", () => {
        it("joins the violation messages", () => {
            const exception = new MultipleValidationException([
                emailBlank,
                nameBlank,
            ]);

            expect(exception.message).toBe("email is blank; name is blank");
        });

        it("throws InvariantViolationException for an empty array", () => {
            expect(() => new MultipleValidationException([])).toThrow(
                InvariantViolationException,
            );
        });

        it("propagates the wrapped cause", () => {
            const cause = new Error("root");
            const exception = new MultipleValidationException([emailBlank], {
                cause,
            });

            expect(exception.cause).toBe(cause);
        });
    });

    describe("accessors", () => {
        const exception = new MultipleValidationException([
            emailBlank,
            emailFormat,
            nameBlank,
        ]);

        it("count reports the number of violations", () => {
            expect(exception.count).toBe(3);
        });

        it("first returns the first violation", () => {
            expect(exception.first).toBe(emailBlank);
        });

        it("byField returns only violations for the given field", () => {
            const emailViolations = exception.byField(
                ValidationField.of("email"),
            );

            expect(emailViolations).toEqual([emailBlank, emailFormat]);
        });

        it("byField returns an empty array for an unmatched field", () => {
            expect(exception.byField(ValidationField.of("phone"))).toEqual([]);
        });
    });
});
