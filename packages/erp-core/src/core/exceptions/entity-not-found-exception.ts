import { DomainException } from "./domain-exception.js";

class EntityNotFoundException extends DomainException {
    constructor(
        public readonly entityName: string,
        public readonly identifier: string,
        options?: { cause?: unknown },
    ) {
        super(
            `${entityName} with identifier ${identifier} was not found.`,
            options,
        );
    }
}

export { EntityNotFoundException };
