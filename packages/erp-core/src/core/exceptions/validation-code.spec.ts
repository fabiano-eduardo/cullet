import { describe, expect, it } from "vitest";

import { ValidationCode } from "./validation-code";

describe("ValidationCode", () => {
    describe("of()", () => {
        it("creates a custom code with the provided value", () => {
            const code = ValidationCode.of("custom_code");

            expect(code.value).toBe("custom_code");
        });

        it("creates distinct instances on separate calls", () => {
            const a = ValidationCode.of("code");
            const b = ValidationCode.of("code");

            expect(a).not.toBe(b);
            expect(a.value).toBe(b.value);
        });

        it("accepts an empty string", () => {
            const code = ValidationCode.of("");

            expect(code.value).toBe("");
        });
    });

    describe("predefined static codes", () => {
        it('BLANK has the value "blank"', () => {
            expect(ValidationCode.BLANK.value).toBe("blank");
        });

        it('REQUIRED has the value "required"', () => {
            expect(ValidationCode.REQUIRED.value).toBe("required");
        });

        it('INVALID_FORMAT has the value "invalid_format"', () => {
            expect(ValidationCode.INVALID_FORMAT.value).toBe("invalid_format");
        });

        it('INVALID_CHARACTERS has the value "invalid_characters"', () => {
            expect(ValidationCode.INVALID_CHARACTERS.value).toBe(
                "invalid_characters",
            );
        });

        it('INVALID_LENGTH has the value "invalid_length"', () => {
            expect(ValidationCode.INVALID_LENGTH.value).toBe("invalid_length");
        });

        it('TOO_SHORT has the value "too_short"', () => {
            expect(ValidationCode.TOO_SHORT.value).toBe("too_short");
        });

        it('TOO_LONG has the value "too_long"', () => {
            expect(ValidationCode.TOO_LONG.value).toBe("too_long");
        });

        it('OUT_OF_RANGE has the value "out_of_range"', () => {
            expect(ValidationCode.OUT_OF_RANGE.value).toBe("out_of_range");
        });

        it('INVALID_CHECKSUM has the value "invalid_checksum"', () => {
            expect(ValidationCode.INVALID_CHECKSUM.value).toBe(
                "invalid_checksum",
            );
        });

        it('INVALID_CHECKING_DIGIT has the value "invalid_checking_digit"', () => {
            expect(ValidationCode.INVALID_CHECKING_DIGIT.value).toBe(
                "invalid_checking_digit",
            );
        });

        it('ALREADY_EXISTS has the value "already_exists"', () => {
            expect(ValidationCode.ALREADY_EXISTS.value).toBe("already_exists");
        });

        it('NOT_FOUND has the value "not_found"', () => {
            expect(ValidationCode.NOT_FOUND.value).toBe("not_found");
        });

        it('NOT_ALLOWED has the value "not_allowed"', () => {
            expect(ValidationCode.NOT_ALLOWED.value).toBe("not_allowed");
        });

        it('UNEXPECTED has the value "unexpected"', () => {
            expect(ValidationCode.UNEXPECTED.value).toBe("unexpected");
        });
    });

    describe("static references", () => {
        it("static instances are always the same reference", () => {
            expect(ValidationCode.REQUIRED).toBe(ValidationCode.REQUIRED);
        });
    });
});
