import { describe, expect, it } from 'vitest';

import { ContextSeedValidator } from './context-seed';

describe('validateContextSeed', () => {
	it('rejects an empty tenantId', () => {
		const result = ContextSeedValidator.validate({
			tenantId: '   ',
			schoolId: 'school-1',
			fields: {},
		});

		expect(result.isErr()).toBe(true);
		expect(result.errorOrNull()).toBe(
			'ContextSeed tenantId must be a non-empty string'
		);
	});

	it('rejects an empty schoolId', () => {
		const result = ContextSeedValidator.validate({
			tenantId: 'tenant-1',
			schoolId: '',
			fields: {},
		});

		expect(result.isErr()).toBe(true);
		expect(result.errorOrNull()).toBe(
			'ContextSeed schoolId must be a non-empty string'
		);
	});

	it('accepts non-empty ids', () => {
		const seed = {
			tenantId: 'tenant-1',
			schoolId: 'school-1',
			fields: {},
		};

		const result = ContextSeedValidator.validate(seed);

		expect(result.isOk()).toBe(true);
		expect(result.getOrNull()).toBe(seed);
	});
});
