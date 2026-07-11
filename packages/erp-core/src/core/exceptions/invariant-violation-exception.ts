import { DomainException } from "./domain-exception.js";

class InvariantViolationException extends DomainException {
    constructor(message: string, options?: { cause?: unknown }) {
        super(message, options);
    }
}

export { InvariantViolationException };
