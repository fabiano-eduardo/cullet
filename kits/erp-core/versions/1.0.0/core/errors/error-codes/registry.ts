import { AppErrorCodes } from './app';
import { ErrorCode } from './base';
import { BusinessErrorCodes } from './business';
import { ConcurrencyErrorCodes } from './concurrency';
import { ConflictErrorCodes } from './conflict';
import { IdempotencyErrorCodes } from './idempotency';
import { LegacyErrorCodes } from './legacy';
import { NotFoundErrorCodes } from './not-found';
import {
	SecurityAuthnErrorCodes,
	SecurityAuthzErrorCodes,
	SecurityErrorCodes,
} from './security';
import { ValidationErrorCodes } from './validation';

export class ErrorCodes {
	public static readonly App = AppErrorCodes;
	public static readonly Validation = ValidationErrorCodes;
	public static readonly NotFound = NotFoundErrorCodes;
	public static readonly Business = BusinessErrorCodes;
	public static readonly Legacy = LegacyErrorCodes;
	public static readonly Security = SecurityErrorCodes;
	public static readonly Concurrency = ConcurrencyErrorCodes;
	public static readonly Conflict = ConflictErrorCodes;
	public static readonly Idempotency = IdempotencyErrorCodes;

	public static all(): readonly ErrorCode[] {
		return Object.freeze([
			...AppErrorCodes.all(),
			...ValidationErrorCodes.all(),
			...NotFoundErrorCodes.all(),
			...BusinessErrorCodes.all(),
			...LegacyErrorCodes.all(),
			...SecurityErrorCodes.all(),
			...ConcurrencyErrorCodes.all(),
			...ConflictErrorCodes.all(),
			...IdempotencyErrorCodes.all(),
		]);
	}
}

export {
	AppErrorCodes,
	BusinessErrorCodes,
	ConcurrencyErrorCodes,
	ConflictErrorCodes,
	IdempotencyErrorCodes,
	LegacyErrorCodes,
	NotFoundErrorCodes,
	SecurityAuthnErrorCodes,
	SecurityAuthzErrorCodes,
	SecurityErrorCodes,
	ValidationErrorCodes,
};
