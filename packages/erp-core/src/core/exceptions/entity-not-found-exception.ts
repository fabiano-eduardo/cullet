import { DomainException } from "./domain-exception.js";

class EntityNotFoundException extends DomainException {
    constructor(
        public readonly entityName: string,
        public readonly identifier: string,
    ) {
        super(`${entityName} with identifier ${identifier} was not found.`);
    }
}

export { EntityNotFoundException };
