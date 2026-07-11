import { DomainException } from "./domain-exception.js";

class BusinessRuleViolationException extends DomainException {
    constructor(
        public readonly rule: string,
        message: string,
        options?: { cause?: unknown },
    ) {
        super(message, options);
    }
}

export { BusinessRuleViolationException };
