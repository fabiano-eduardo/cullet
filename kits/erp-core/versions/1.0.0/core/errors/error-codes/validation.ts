import { ErrorCode } from './base';

export class ValidationErrorCodes {
	public static readonly InvalidInput = ErrorCode.define(
		'val.invalid_input',
		'Invalid input (shape/required).'
	);

	public static readonly InvalidFormat = ErrorCode.define(
		'val.invalid_format',
		'Invalid format (e.g.: email/cpf/cnpj).'
	);

	public static readonly InvalidType = ErrorCode.define(
		'val.invalid_type',
		'Invalid type (e.g.: string vs number).'
	);

	public static readonly OutOfRange = ErrorCode.define(
		'val.out_of_range',
		'Out of range.'
	);

	public static readonly MissingRequired = ErrorCode.define(
		'val.missing_required',
		'Required field missing for this flow.'
	);

	public static readonly UnsupportedVersion = ErrorCode.define(
		'val.unsupported_version',
		'Schema/payload version is not supported.'
	);

	public static all(): readonly ErrorCode[] {
		return Object.freeze([
			this.InvalidInput,
			this.InvalidFormat,
			this.InvalidType,
			this.OutOfRange,
			this.MissingRequired,
			this.UnsupportedVersion,
		]);
	}
}
