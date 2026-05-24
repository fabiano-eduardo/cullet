import { SecurityAuthnErrorCodes } from './authn';
import { SecurityAuthzErrorCodes } from './authz';
import { ErrorCode } from '../base';

export class SecurityErrorCodes {
	public static readonly Authn = SecurityAuthnErrorCodes;
	public static readonly Authz = SecurityAuthzErrorCodes;

	public static all(): readonly ErrorCode[] {
		return Object.freeze([
			...SecurityAuthnErrorCodes.all(),
			...SecurityAuthzErrorCodes.all(),
		]);
	}
}

export { SecurityAuthnErrorCodes, SecurityAuthzErrorCodes };
