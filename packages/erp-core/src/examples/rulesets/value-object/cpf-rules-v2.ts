import { DomainException } from "../../../core/exceptions/domain-exception.js";
import { type ValueObjectRuleset } from "../../../core/domain/rulesets/value-object-ruleset.contracts.js";
import { CPFRulesV1 } from "./cpf-rules-v1.js";

class CPFBlocklistException extends DomainException {}

class CPFRulesV2 implements ValueObjectRuleset<string> {
    readonly id = "cpf-rules@2.0" as const;
    readonly description =
        "CPF validation with check-digit algorithm and blocklist";

    private readonly v1 = new CPFRulesV1();

    constructor(private readonly blocklist: readonly string[]) {}

    validate(value: string): void {
        this.v1.validate(value);

        if (this.blocklist.includes(value)) {
            throw new CPFBlocklistException(
                `CPF "${value}" appears on the blocklist.`,
            );
        }
    }
}

export { CPFRulesV2 };
