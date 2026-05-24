import { describe, expect, it } from 'vitest';

import { DomainException } from '../../exceptions/domain-exception';
import {
	type Ruleset,
	type RulesetId,
	type RulesetRegistry as RulesetRegistryContract,
} from './ruleset.contracts';

// TODO: replace with concrete imports in the green step.
declare const RulesetRegistry: new () => RulesetRegistryContract;

function makeRuleset(id: RulesetId, description = 'test ruleset'): Ruleset {
	return {
		id,
		description,
	};
}

function expectDomainError(callback: () => void): void {
	try {
		callback();
	} catch (error) {
		expect(error).toBeInstanceOf(DomainException);
		return;
	}

	throw new Error('Expected DomainError to be thrown');
}

describe('RulesetRegistry', () => {
	it('registers a ruleset successfully', () => {
		const registry = new RulesetRegistry();
		const ruleset = makeRuleset('order-creation@1.0');

		registry.register(ruleset);

		expect(registry.get<Ruleset>(ruleset.id)).toBe(ruleset);
	});

	it('throws DomainError when registering a duplicate ID', () => {
		const registry = new RulesetRegistry();
		const ruleset = makeRuleset('order-creation@1.0');

		registry.register(ruleset);

		expectDomainError(() =>
			registry.register(makeRuleset('order-creation@1.0'))
		);
	});

	it('throws DomainError when registering after seal()', () => {
		const registry = new RulesetRegistry();

		registry.seal();

		expectDomainError(() =>
			registry.register(makeRuleset('order-creation@1.0'))
		);
	});

	it('returns the correct instance from get()', () => {
		const registry = new RulesetRegistry();
		const ruleset = makeRuleset('order-invariant@1.0');

		registry.register(ruleset);

		expect(registry.get<Ruleset>('order-invariant@1.0')).toBe(ruleset);
	});

	it('throws a descriptive error when the ID does not exist', () => {
		const registry = new RulesetRegistry();

		expect(() => registry.get<Ruleset>('order-invariant@9.9')).toThrow(
			'order-invariant@9.9'
		);
	});

	it('returns the most recent version for a prefix', () => {
		const registry = new RulesetRegistry();
		const v19 = makeRuleset('order-invariant@1.9');
		const v110 = makeRuleset('order-invariant@1.10');

		registry.register(v19);
		registry.register(v110);

		expect(registry.getCurrent<Ruleset>('order-invariant')).toBe(v110);
	});
});
