import { ErrorCode } from './base';

export class ConflictErrorCodes {
	public static readonly Duplicate = ErrorCode.define(
		'conf.duplicate',
		'Duplicate (uniqueness violated).'
	);

	public static readonly UniqueViolation = ErrorCode.define(
		'conf.unique_violation',
		'Unique constraint violation (infrastructure).'
	);

	public static readonly Conflict = ErrorCode.define(
		'conf.conflict',
		'Generic intent conflict (e.g.: "already exists", "already linked").'
	);

	public static all(): readonly ErrorCode[] {
		return Object.freeze([
			this.Duplicate,
			this.UniqueViolation,
			this.Conflict,
		]);
	}
}
