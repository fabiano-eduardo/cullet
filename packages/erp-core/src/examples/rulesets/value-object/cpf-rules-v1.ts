import {
    DomainException,
    type ValueObjectRuleset,
} from "../../../core/domain/rulesets/value-object-ruleset.contracts";

class CPFValidationError extends DomainException {}

function validateCheckDigits(digits: number[]): boolean {
    // First check digit: multiply first 9 digits by weights 10..2
    let sum = 0;
    for (let i = 0; i < 9; i++) {
        sum += digits[i]! * (10 - i);
    }
    const rem1 = sum % 11;
    const expected1 = rem1 < 2 ? 0 : 11 - rem1;
    if (digits[9] !== expected1) return false;

    // Second check digit: multiply first 10 digits by weights 11..2
    sum = 0;
    for (let i = 0; i < 10; i++) {
        sum += digits[i]! * (11 - i);
    }
    const rem2 = sum % 11;
    const expected2 = rem2 < 2 ? 0 : 11 - rem2;
    return digits[10] === expected2;
}

class CPFRulesV1 implements ValueObjectRuleset<string> {
    readonly id = "cpf-rules@1.0" as const;
    readonly description = "CPF validation using the check-digit algorithm";

    validate(value: string): void {
        if (!/^\d{11}$/.test(value)) {
            throw new CPFValidationError(
                `CPF must contain exactly 11 numeric digits. Received: "${value}".`,
            );
        }

        if (/^(\d)\1{10}$/.test(value)) {
            throw new CPFValidationError(
                `A CPF with all repeating digits is invalid: "${value}".`,
            );
        }

        const digits = value.split("").map(Number);
        if (!validateCheckDigits(digits)) {
            throw new CPFValidationError(
                `Invalid check digits for CPF "${value}".`,
            );
        }
    }
}

export { CPFRulesV1 };
