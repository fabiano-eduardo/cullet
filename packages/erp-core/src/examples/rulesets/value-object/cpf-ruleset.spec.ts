import { describe, expect, it } from "vitest";

import { CPF } from "./cpf";
import { CPFRulesV1 } from "./cpf-rules-v1";
import { CPFRulesV2 } from "./cpf-rules-v2";
import {
    DomainException,
    type RulesetId,
    type ValueObjectRuleset,
} from "../../../core/domain/rulesets/value-object-ruleset.contracts";

const VALID_CPF = "52998224725";
const OTHER_VALID_CPF = "12345678909";
const INVALID_CHECK_DIGITS_CPF = "52998224724";

function expectCPFToBeRejected(
    raw: string,
    ruleset: ValueObjectRuleset<string>,
): void {
    try {
        CPF.create(raw, ruleset);
    } catch (error) {
        expect(error).toBeInstanceOf(DomainException);
        return;
    }

    throw new Error("Expected DomainError to be thrown");
}

describe("ValueObjectRuleset contract", () => {
    it("accepts any object compatible with ValueObjectRuleset<string> in CPF.create", () => {
        let validatedValue = "";
        const adHocRuleset: ValueObjectRuleset<string> = {
            id: "cpf-rules@9.9" as RulesetId,
            description: "ad-hoc ruleset for contract",
            validate(value: string) {
                validatedValue = value;
            },
        };

        const cpf = CPF.create(VALID_CPF, adHocRuleset);

        expect(validatedValue).toBe(VALID_CPF);
        expect(cpf.appliedRulesetId).toBe(adHocRuleset.id);
    });
});

describe("CPFRulesV1", () => {
    it("creates a CPF successfully when the value is valid", () => {
        const ruleset = new CPFRulesV1();

        const cpf = CPF.create(VALID_CPF, ruleset);

        expect(cpf.value).toBe(VALID_CPF);
        expect(cpf.appliedRulesetId).toBe("cpf-rules@1.0");
    });

    it("throws DomainError with fewer than 11 digits", () => {
        const ruleset = new CPFRulesV1();

        expectCPFToBeRejected("1234567890", ruleset);
    });

    it("throws DomainError with more than 11 digits", () => {
        const ruleset = new CPFRulesV1();

        expectCPFToBeRejected("123456789012", ruleset);
    });

    it("throws DomainError with non-numeric characters", () => {
        const ruleset = new CPFRulesV1();

        expectCPFToBeRejected("5299822472a", ruleset);
    });

    it("throws DomainError with invalid check digits", () => {
        const ruleset = new CPFRulesV1();

        expectCPFToBeRejected(INVALID_CHECK_DIGITS_CPF, ruleset);
    });

    it("throws DomainError for a CPF with all repeating digits", () => {
        const ruleset = new CPFRulesV1();

        expectCPFToBeRejected("00000000000", ruleset);
    });
});

describe("CPFRulesV2", () => {
    it("creates a CPF successfully when the value is valid and not blocklisted", () => {
        const ruleset = new CPFRulesV2(["11144477735"]);

        const cpf = CPF.create(VALID_CPF, ruleset);

        expect(cpf.value).toBe(VALID_CPF);
        expect(cpf.appliedRulesetId).toBe("cpf-rules@2.0");
    });

    it("throws DomainError with fewer than 11 digits", () => {
        const ruleset = new CPFRulesV2([]);

        expectCPFToBeRejected("1234567890", ruleset);
    });

    it("throws DomainError with more than 11 digits", () => {
        const ruleset = new CPFRulesV2([]);

        expectCPFToBeRejected("123456789012", ruleset);
    });

    it("throws DomainError with non-numeric characters", () => {
        const ruleset = new CPFRulesV2([]);

        expectCPFToBeRejected("5299822472a", ruleset);
    });

    it("throws DomainError with invalid check digits", () => {
        const ruleset = new CPFRulesV2([]);

        expectCPFToBeRejected(INVALID_CHECK_DIGITS_CPF, ruleset);
    });

    it("throws DomainError for a CPF with all repeating digits", () => {
        const ruleset = new CPFRulesV2([]);

        expectCPFToBeRejected("00000000000", ruleset);
    });

    it("throws DomainError when the CPF is in the blocklist", () => {
        const ruleset = new CPFRulesV2([OTHER_VALID_CPF]);

        expectCPFToBeRejected(OTHER_VALID_CPF, ruleset);
    });
});

describe("CPF equals", () => {
    it("returns true for CPFs with the same value regardless of appliedRulesetId", () => {
        const created = CPF.create(VALID_CPF, new CPFRulesV1());
        const reconstituted = CPF.reconstitute(VALID_CPF, "cpf-rules@2.0");

        expect(created.equals(reconstituted)).toBe(true);
    });

    it("returns false for CPFs with different values", () => {
        const first = CPF.create(VALID_CPF, new CPFRulesV1());
        const second = CPF.reconstitute(OTHER_VALID_CPF, "cpf-rules@2.0");

        expect(first.equals(second)).toBe(false);
    });
});
