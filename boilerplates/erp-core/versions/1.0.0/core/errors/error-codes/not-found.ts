import { ErrorCode } from './base';

export class NotFoundErrorCodes {
	public static readonly NotFound = ErrorCode.define(
		'nof.not_found',
		'Resource not found.'
	);

	public static readonly ReferenceNotFound = ErrorCode.define(
		'nof.reference_not_found',
		'Reference/relationship not found (logical FK).'
	);

	public static all(): readonly ErrorCode[] {
		return Object.freeze([this.NotFound, this.ReferenceNotFound]);
	}
}
