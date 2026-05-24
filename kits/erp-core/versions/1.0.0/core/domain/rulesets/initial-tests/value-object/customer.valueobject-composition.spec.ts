import { describe, expect, it } from 'vitest';

import { type CPFStatic } from './cpf';
import {
	type CustomerCreateData,
	type CustomerSnapshot,
	type CustomerStatic,
} from './customer';
import { type PersonNameStatic } from './person-name';
import { type ValueObjectRuleset } from '../../value-object-ruleset.contracts';

// TODO: replace with concrete imports in the green step.
declare const Customer: CustomerStatic;
declare const CPF: CPFStatic;
declare const PersonName: PersonNameStatic;
declare const CPFRulesV1: new () => ValueObjectRuleset<string>;
declare const PersonNameRulesV2: new () => ValueObjectRuleset<string>;

function makeCustomerCreateData(
	overrides: Partial<CustomerCreateData> = {}
): CustomerCreateData {
	return {
		cpf: '52998224725',
		name: 'Anne-Marie Smith',
		...overrides,
	};
}

function makeCustomerSnapshot(
	overrides: Partial<CustomerSnapshot> = {}
): CustomerSnapshot {
	return {
		cpf_value: '00000000000',
		cpf_ruleset: 'cpf-rules@1.0',
		name_value: 'A',
		name_ruleset: 'person-name-rules@1.0',
		...overrides,
	};
}

describe('Customer value object composition', () => {
	it('exposes the appliedRulesetIds of the value objects used at creation', () => {
		const customer = Customer.create(makeCustomerCreateData(), {
			cpf: new CPFRulesV1(),
			name: new PersonNameRulesV2(),
		});

		expect(customer.cpf.appliedRulesetId).toBe('cpf-rules@1.0');
		expect(customer.name.appliedRulesetId).toBe('person-name-rules@2.0');
	});

	it('preserves the original appliedRulesetId of child value objects on reconstitution', () => {
		const customer = Customer.reconstitute(makeCustomerSnapshot());

		expect(customer.cpf.appliedRulesetId).toBe('cpf-rules@1.0');
		expect(customer.name.appliedRulesetId).toBe('person-name-rules@1.0');
	});

	it('does not re-validate child value objects when reconstituting from storage', () => {
		expect(() =>
			Customer.reconstitute(
				makeCustomerSnapshot({
					cpf_value: '00000000000',
					name_value: 'A',
				})
			)
		).not.toThrow();
	});
});
