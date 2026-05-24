import { Result } from '../../result/result';

/**
 * PolicyKey value object.
 *
 * Format: `module.area.policy_name` (exactly 3 dot-separated segments).
 * - module: structural segment (lowercase alphanumeric + underscore, starting with a letter)
 * - area:   structural segment (lowercase alphanumeric + underscore, starting with a letter)
 * - name:   specific policy identifier (lowercase alphanumeric + underscore, starting with a letter)
 */

const SEGMENT_PATTERN = /^[a-z][a-z0-9_]*$/;
const MAX_POLICY_KEY_LENGTH = 255;

export class PolicyKey {
	public readonly module: string;
	public readonly area: string;
	public readonly name: string;

	private constructor(module: string, area: string, name: string) {
		this.module = module;
		this.area = area;
		this.name = name;
		Object.freeze(this);
	}

	static parse(raw: string): Result<PolicyKey, string> {
		if (!raw || typeof raw !== 'string') {
			return Result.err('PolicyKey cannot be empty');
		}

		if (raw.length > MAX_POLICY_KEY_LENGTH) {
			return Result.err(
				`PolicyKey cannot exceed ${MAX_POLICY_KEY_LENGTH} characters, got ${raw.length}`
			);
		}

		const segments = raw.split('.');
		if (segments.length !== 3) {
			return Result.err(
				`PolicyKey must have exactly 3 segments (module.area.name), got ${segments.length}: "${raw}"`
			);
		}

		const [rawModule, rawArea, name] = segments;

		if (!SEGMENT_PATTERN.test(rawModule)) {
			return Result.err(
				`PolicyKey segment "module" is invalid: "${rawModule}". ` +
					'Must start with a lowercase letter and contain only [a-z0-9_].'
			);
		}

		if (!SEGMENT_PATTERN.test(rawArea)) {
			return Result.err(
				`PolicyKey segment "area" is invalid: "${rawArea}". ` +
					'Must start with a lowercase letter and contain only [a-z0-9_].'
			);
		}

		if (!SEGMENT_PATTERN.test(name)) {
			return Result.err(
				`PolicyKey segment "name" is invalid: "${name}". ` +
					'Must start with a lowercase letter and contain only [a-z0-9_].'
			);
		}

		return Result.ok(new PolicyKey(rawModule, rawArea, name));
	}

	toString(): string {
		return `${this.module}.${this.area}.${this.name}`;
	}

	equals(other: PolicyKey): boolean {
		return this.toString() === other.toString();
	}
}
