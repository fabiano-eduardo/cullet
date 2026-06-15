import { CPF } from "./cpf.js";
import { PersonName } from "./person-name.js";
import {
    type RulesetId,
    type ValueObjectRuleset,
} from "../../../core/domain/rulesets/value-object-ruleset.contracts.js";

interface CustomerCreateData {
    readonly cpf: string;
    readonly name: string;
}

interface CustomerCreateRulesets {
    readonly cpf: ValueObjectRuleset<string>;
    readonly name: ValueObjectRuleset<string>;
}

interface CustomerSnapshot {
    readonly cpf_value: string;
    readonly cpf_ruleset: RulesetId;
    readonly name_value: string;
    readonly name_ruleset: RulesetId;
}

interface CustomerStatic {
    create(
        data: CustomerCreateData,
        rulesets: CustomerCreateRulesets,
    ): Customer;
    reconstitute(snapshot: CustomerSnapshot): Customer;
}

class Customer {
    readonly cpf: CPF;
    readonly name: PersonName;

    private constructor(cpf: CPF, name: PersonName) {
        this.cpf = cpf;
        this.name = name;
    }

    static create(
        data: CustomerCreateData,
        rulesets: CustomerCreateRulesets,
    ): Customer {
        const cpf = CPF.create(data.cpf, rulesets.cpf);
        const name = PersonName.create(data.name, rulesets.name);
        return new Customer(cpf, name);
    }

    static reconstitute(snapshot: CustomerSnapshot): Customer {
        const cpf = CPF.reconstitute(snapshot.cpf_value, snapshot.cpf_ruleset);
        const name = PersonName.reconstitute(
            snapshot.name_value,
            snapshot.name_ruleset,
        );
        return new Customer(cpf, name);
    }
}

const _typeCheck: CustomerStatic = Customer;
void _typeCheck;

export {
    Customer,
    type CustomerCreateData,
    type CustomerCreateRulesets,
    type CustomerSnapshot,
    type CustomerStatic,
};
