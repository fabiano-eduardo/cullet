import { DomainException } from "./domain-exception.js";

class BusinessRuleViolationException extends DomainException {
    constructor(
        public readonly rule: string,
        message: string,
    ) {
        super(message);
    }
}

export { BusinessRuleViolationException };
