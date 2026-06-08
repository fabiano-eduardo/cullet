import {
    type RulesetId,
    type ValueObjectRuleset,
} from "../../../core/domain/rulesets/value-object-ruleset.contracts";

interface CPFStatic {
    create(raw: string, ruleset: ValueObjectRuleset<string>): CPF;
    reconstitute(value: string, rulesetId: RulesetId): CPF;
}

class CPF {
    readonly value: string;
    readonly appliedRulesetId: RulesetId;

    private constructor(value: string, appliedRulesetId: RulesetId) {
        this.value = value;
        this.appliedRulesetId = appliedRulesetId;
    }

    equals(other: CPF): boolean {
        return this.value === other.value;
    }

    static create(raw: string, ruleset: ValueObjectRuleset<string>): CPF {
        ruleset.validate(raw);
        return new CPF(raw, ruleset.id);
    }

    static reconstitute(value: string, rulesetId: RulesetId): CPF {
        return new CPF(value, rulesetId);
    }
}

const _typeCheck: CPFStatic = CPF;
void _typeCheck;

export { CPF, type CPFStatic };
