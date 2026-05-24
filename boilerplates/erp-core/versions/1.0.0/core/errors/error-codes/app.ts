import { ErrorCode } from './base';

export class AppErrorCodes {
	public static readonly Unexpected = ErrorCode.define(
		'app.unexpected',
		'Unclassified failure (bug or internal fault).'
	);

	public static readonly DependencyFailure = ErrorCode.define(
		'app.dependency_failure',
		'Internal dependency failure (internal module or service).'
	);

	public static readonly InvariantBroken = ErrorCode.define(
		'app.invariant_broken',
		'Broken internal invariant (should be "impossible").'
	);

	public static all(): readonly ErrorCode[] {
		return Object.freeze([
			this.Unexpected,
			this.DependencyFailure,
			this.InvariantBroken,
		]);
	}
}
