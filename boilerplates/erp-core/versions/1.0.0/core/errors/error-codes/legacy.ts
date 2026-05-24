import { ErrorCode } from './base';

export class LegacyErrorCodes {
	public static readonly Incompatible = ErrorCode.define(
		'legacy.incompatible',
		'Legacy record incompatible with the modern flow.'
	);

	public static readonly MissingFact = ErrorCode.define(
		'legacy.missing_fact',
		'Required fact is missing (e.g.: activationInfo).'
	);

	public static readonly UnsupportedSchema = ErrorCode.define(
		'legacy.unsupported_schema',
		'Legacy schema not supported (migration/upgrade required).'
	);

	public static readonly UpgradeRequired = ErrorCode.define(
		'legacy.upgrade_required',
		'Explicit regularization/upgrade required.'
	);

	public static all(): readonly ErrorCode[] {
		return Object.freeze([
			this.Incompatible,
			this.MissingFact,
			this.UnsupportedSchema,
			this.UpgradeRequired,
		]);
	}
}
