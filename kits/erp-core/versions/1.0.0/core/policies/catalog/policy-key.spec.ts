import { describe, expect, it } from 'vitest';

import { PolicyKey } from './policy-key';

describe('PolicyKey', () => {
	it('rejects keys above the maximum limit', () => {
		const oversizedKey = `financial.${'a'.repeat(120)}.${'b'.repeat(130)}`;

		const result = PolicyKey.parse(oversizedKey);

		expect(result.isErr()).toBe(true);
		expect(result.errorOrNull()).toBe(
			'PolicyKey cannot exceed 255 characters, got 261'
		);
	});
});
