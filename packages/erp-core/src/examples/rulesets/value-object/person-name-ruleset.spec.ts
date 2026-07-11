import { describe, expect, it } from "vitest";

import { PersonName } from "./person-name.js";
import { PersonNameRulesV1 } from "./person-name-rules-v1.js";
import { PersonNameRulesV2 } from "./person-name-rules-v2.js";
import { DomainException } from "../../../core/exceptions/domain-exception.js";
import {
    type RulesetId,
    type ValueObjectRuleset,
} from "../../../core/domain/rulesets/value-object-ruleset.contracts.js";

function expectPersonNameToBeRejected(
    raw: string,
    ruleset: ValueObjectRuleset<string>,
): void {
    try {
        PersonName.create(raw, ruleset);
    } catch (error) {
        expect(error).toBeInstanceOf(DomainException);
        return;
    }

    throw new Error("Expected DomainError to be thrown");
}

describe("ValueObjectRuleset contract", () => {
    it("accepts any object compatible with ValueObjectRuleset<string> in PersonName.create", () => {
        let validatedValue = "";
        const adHocRuleset: ValueObjectRuleset<string> = {
            id: "person-name-rules@9.9" as RulesetId,
            description: "ad-hoc ruleset for contract",
            validate(value: string) {
                validatedValue = value;
            },
        };

        const name = PersonName.create("Mary Smith", adHocRuleset);

        expect(validatedValue).toBe("Mary Smith");
        expect(name.appliedRulesetId).toBe(adHocRuleset.id);
    });
});

describe("PersonNameRulesV1", () => {
    it("creates a valid name with two or more words", () => {
        const ruleset = new PersonNameRulesV1();

        const name = PersonName.create("Mary Smith", ruleset);

        expect(name.value).toBe("Mary Smith");
        expect(name.appliedRulesetId).toBe("person-name-rules@1.0");
    });

    it("throws DomainError for an empty string", () => {
        const ruleset = new PersonNameRulesV1();

        expectPersonNameToBeRejected("", ruleset);
    });

    it("throws DomainError for a single word", () => {
        const ruleset = new PersonNameRulesV1();

        expectPersonNameToBeRejected("Madonna", ruleset);
    });

    it("throws DomainError when a word has only one letter", () => {
        const ruleset = new PersonNameRulesV1();

        expectPersonNameToBeRejected("A Smith", ruleset);
    });
});

describe("PersonNameRulesV2", () => {
    it("creates a valid name with two or more words", () => {
        const ruleset = new PersonNameRulesV2();

        const name = PersonName.create("Mary Smith", ruleset);

        expect(name.value).toBe("Mary Smith");
        expect(name.appliedRulesetId).toBe("person-name-rules@2.0");
    });

    it("throws DomainError for an empty string", () => {
        const ruleset = new PersonNameRulesV2();

        expectPersonNameToBeRejected("", ruleset);
    });

    it("throws DomainError for a single word", () => {
        const ruleset = new PersonNameRulesV2();

        expectPersonNameToBeRejected("Madonna", ruleset);
    });

    it("throws DomainError when a word has only one letter", () => {
        const ruleset = new PersonNameRulesV2();

        expectPersonNameToBeRejected("A Smith", ruleset);
    });

    it("throws DomainError when the name contains numbers", () => {
        const ruleset = new PersonNameRulesV2();

        expectPersonNameToBeRejected("John 2 Smith", ruleset);
    });

    it("throws DomainError with disallowed special characters", () => {
        const ruleset = new PersonNameRulesV2();

        expectPersonNameToBeRejected("John@ Smith", ruleset);
    });

    it("accepts hyphens as valid characters", () => {
        const ruleset = new PersonNameRulesV2();

        const name = PersonName.create("Anne-Marie Smith", ruleset);

        expect(name.value).toBe("Anne-Marie Smith");
    });

    it("accepts apostrophes as valid characters", () => {
        const ruleset = new PersonNameRulesV2();

        const name = PersonName.create("D'Angelo Smith", ruleset);

        expect(name.value).toBe("D'Angelo Smith");
    });
});
