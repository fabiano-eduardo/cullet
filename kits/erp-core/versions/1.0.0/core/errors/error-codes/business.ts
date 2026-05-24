import { ErrorCode } from './base';

export class BusinessErrorCodes {
	public static readonly Violation = ErrorCode.define(
		'bur.violation',
		'Generic business rule violation.'
	);

	public static readonly InvalidState = ErrorCode.define(
		'bur.invalid_state',
		'Invalid state for the operation.'
	);

	public static readonly PreconditionFailed = ErrorCode.define(
		'bur.precondition_failed',
		'Precondition not satisfied (known prior state).'
	);

	public static readonly TransitionNotAllowed = ErrorCode.define(
		'bur.transition_not_allowed',
		'Status transition is not allowed.'
	);

	public static readonly AlreadyDone = ErrorCode.define(
		'bur.already_done',
		'Redundant operation (already executed).'
	);

	public static all(): readonly ErrorCode[] {
		return Object.freeze([
			this.Violation,
			this.InvalidState,
			this.PreconditionFailed,
			this.TransitionNotAllowed,
			this.AlreadyDone,
		]);
	}
}
