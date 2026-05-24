import { ErrorCode } from '../base';

export class SecurityAuthnErrorCodes {
	public static readonly MissingCredentials = ErrorCode.define(
		'sec.authn.missing_credentials',
		'Missing credentials.'
	);

	public static readonly InvalidCredentials = ErrorCode.define(
		'sec.authn.invalid_credentials',
		'Invalid credentials.'
	);

	public static readonly InvalidToken = ErrorCode.define(
		'sec.authn.invalid_token',
		'Invalid or malformed token.'
	);

	public static readonly ExpiredToken = ErrorCode.define(
		'sec.authn.expired_token',
		'Expired token.'
	);

	public static readonly RevokedToken = ErrorCode.define(
		'sec.authn.revoked_token',
		'Token/session revoked.'
	);

	public static all(): readonly ErrorCode[] {
		return Object.freeze([
			this.MissingCredentials,
			this.InvalidCredentials,
			this.InvalidToken,
			this.ExpiredToken,
			this.RevokedToken,
		]);
	}
}
