import { DomainException } from "./domain-exception.js";

class InvariantViolationException extends DomainException {
    constructor(message: string) {
        super(message);
    }
}

export { InvariantViolationException };
