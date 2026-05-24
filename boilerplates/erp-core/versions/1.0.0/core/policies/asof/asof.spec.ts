import { describe, expect, it } from 'vitest';

import { PolicyAsOfResolver } from './asof';

describe('deriveAsOf', () => {
	it('mantem o limite padrao de 10 anos no futuro', () => {
		const result = PolicyAsOfResolver.derive(
			'CALLER_PROVIDED',
			{
				tenantId: 'tenant-1',
				schoolId: 'school-1',
				fields: {
					asOf: new Date('2037-01-01T00:00:00.000Z'),
				},
			},
			new Date('2026-01-01T00:00:00.000Z')
		);

		expect(result.isErr()).toBe(true);
		expect(result.errorOrNull()).toBe(
			'asOf date is more than 10 years in the future (received 2037-01-01T00:00:00.000Z)'
		);
	});

	it('accepts a future window configured by the caller', () => {
		const result = PolicyAsOfResolver.derive(
			'CALLER_PROVIDED',
			{
				tenantId: 'tenant-1',
				schoolId: 'school-1',
				fields: {
					asOf: new Date('2041-01-01T00:00:00.000Z'),
				},
			},
			new Date('2026-01-01T00:00:00.000Z'),
			{
				maxFutureYears: 20,
			}
		);

		expect(result.isOk()).toBe(true);
		expect(result.getOrNull()!.toISOString()).toBe(
			'2041-01-01T00:00:00.000Z'
		);
	});
});
