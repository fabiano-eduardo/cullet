import {
	type RulesetId,
	type ValueObjectRuleset,
} from '../../value-object-ruleset.contracts';

interface PersonNameStatic {
	create(raw: string, ruleset: ValueObjectRuleset<string>): PersonName;
	reconstitute(value: string, rulesetId: RulesetId): PersonName;
}

class PersonName {
	readonly value: string;
	readonly appliedRulesetId: RulesetId;

	private constructor(value: string, appliedRulesetId: RulesetId) {
		this.value = value;
		this.appliedRulesetId = appliedRulesetId;
	}

	equals(other: PersonName): boolean {
		const normalize = (v: string) =>
			v.trim().replace(/\s+/g, ' ').toLowerCase();
		return normalize(this.value) === normalize(other.value);
	}

	static create(
		raw: string,
		ruleset: ValueObjectRuleset<string>
	): PersonName {
		ruleset.validate(raw);
		return new PersonName(raw, ruleset.id);
	}

	static reconstitute(value: string, rulesetId: RulesetId): PersonName {
		return new PersonName(value, rulesetId);
	}
}

const _typeCheck: PersonNameStatic = PersonName;
void _typeCheck;

export { PersonName, type PersonNameStatic };
