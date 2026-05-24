import { DomainException } from './domain-exception';

class BusinessRuleViolationException extends DomainException {
	constructor(
		public readonly rule: string,
		message: string
	) {
		super(message);
	}
}

export { BusinessRuleViolationException };
