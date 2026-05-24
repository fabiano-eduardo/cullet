import { DomainException } from './domain-exception';

class InvariantViolationException extends DomainException {
	constructor(message: string) {
		super(message);
	}
}

export { InvariantViolationException };
