import { ErrorCode } from './base';

export class ConcurrencyErrorCodes {
	public static readonly OptimisticLock = ErrorCode.define(
		'con.optimistic_lock',
		'Version conflict (lost update prevented).'
	);

	public static readonly StaleObject = ErrorCode.define(
		'con.stale_object',
		'Stale snapshot.'
	);

	public static readonly ConcurrentModification = ErrorCode.define(
		'con.concurrent_modification',
		'Concurrent modification detected (generic).'
	);

	public static readonly LockTimeout = ErrorCode.define(
		'con.lock_timeout',
		'Lock timeout (when applicable).'
	);

	public static all(): readonly ErrorCode[] {
		return Object.freeze([
			this.OptimisticLock,
			this.StaleObject,
			this.ConcurrentModification,
			this.LockTimeout,
		]);
	}
}
