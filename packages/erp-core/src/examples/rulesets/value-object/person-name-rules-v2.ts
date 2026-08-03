import { DomainException } from "../../../core/exceptions/domain-exception.js";
import { type ValueObjectRuleset } from "../../../core/domain/rulesets/value-object-ruleset.contracts.js";
import { PersonNameRulesV1 } from "./person-name-rules-v1.js";

class PersonNameCharacterException extends DomainException {}

class PersonNameRulesV2 implements ValueObjectRuleset<string> {
    readonly id = "person-name-rules@2.0" as const;
    readonly description =
        "Name validation with restriction on special characters";

    private readonly v1 = new PersonNameRulesV1();

    validate(value: string): void {
        this.v1.validate(value);

        if (/[^a-zA-ZÀ-ÿ\s'-]/.test(value)) {
            throw new PersonNameCharacterException(
                `Name contains invalid characters: "${value}". Only letters, hyphens, and apostrophes are allowed.`,
            );
        }
    }
}

export { PersonNameRulesV2 };
