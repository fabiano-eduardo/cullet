import {
    DomainException,
    type ValueObjectRuleset,
} from "../../../core/domain/rulesets/value-object-ruleset.contracts";

class PersonNameValidationError extends DomainException {}

class PersonNameRulesV1 implements ValueObjectRuleset<string> {
    readonly id = "person-name-rules@1.0" as const;
    readonly description = "Name validation requiring at least two words";

    validate(value: string): void {
        const trimmed = value.trim();

        if (trimmed.length === 0) {
            throw new PersonNameValidationError("Name cannot be empty.");
        }

        const words = trimmed.split(/\s+/);

        if (words.length < 2) {
            throw new PersonNameValidationError(
                `Name must have at least two words. Received: "${value}".`,
            );
        }

        for (const word of words) {
            if (word.length < 2) {
                throw new PersonNameValidationError(
                    `Each word of the name must be at least two characters long. Invalid word: "${word}".`,
                );
            }
        }
    }
}

export { PersonNameRulesV1 };
