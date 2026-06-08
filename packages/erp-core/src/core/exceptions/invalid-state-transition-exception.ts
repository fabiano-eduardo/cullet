import { DomainException } from "./domain-exception";

class InvalidStateTransitionException<
    TState extends string = string,
> extends DomainException {
    constructor(
        public readonly from: TState,
        public readonly to: TState,
        message: string,
    ) {
        super(message);
    }
}

export { InvalidStateTransitionException };
