import { ErrorCode } from './base';

export class IdempotencyErrorCodes {
	public static readonly KeyMissing = ErrorCode.define(
		'idemp.key_missing',
		'Idempotency key/commandId missing where required.'
	);

	public static readonly InProgress = ErrorCode.define(
		'idemp.in_progress',
		'The same intent is already in progress.'
	);

	public static readonly Replay = ErrorCode.define(
		'idemp.replay',
		'Replay detected (same request hash).'
	);

	public static readonly PayloadMismatch = ErrorCode.define(
		'idemp.payload_mismatch',
		'Idempotency key reused with a different payload (dangerous).'
	);

	public static all(): readonly ErrorCode[] {
		return Object.freeze([
			this.KeyMissing,
			this.InProgress,
			this.Replay,
			this.PayloadMismatch,
		]);
	}
}
