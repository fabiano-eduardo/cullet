import { ErrorCode } from '../base';

export class SecurityAuthzErrorCodes {
	public static readonly Forbidden = ErrorCode.define(
		'sec.authz.forbidden',
		'Action not allowed.'
	);

	public static readonly PolicyDenied = ErrorCode.define(
		'sec.authz.policy_denied',
		'Policy explicitly denied.'
	);

	public static readonly MissingRole = ErrorCode.define(
		'sec.authz.missing_role',
		'Missing role.'
	);

	public static readonly MissingCapability = ErrorCode.define(
		'sec.authz.missing_capability',
		'Missing capability/feature permission.'
	);

	public static readonly OutOfScope = ErrorCode.define(
		'sec.authz.out_of_scope',
		'Out of scope (tenant/school/class).'
	);

	public static readonly OutsideTimeWindow = ErrorCode.define(
		'sec.authz.outside_time_window',
		'Outside the allowed time window.'
	);

	public static all(): readonly ErrorCode[] {
		return Object.freeze([
			this.Forbidden,
			this.PolicyDenied,
			this.MissingRole,
			this.MissingCapability,
			this.OutOfScope,
			this.OutsideTimeWindow,
		]);
	}
}
