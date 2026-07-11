import { DomainException } from "./domain-exception.js";

class InvalidStateTransitionException<
    TState extends string = string,
> extends DomainException {
    constructor(
        public readonly from: TState,
        public readonly to: TState,
        message?: string,
        options?: { cause?: unknown },
    ) {
        // Compose a sensible default from `from`/`to` when no message is given,
        // mirroring how EntityNotFoundException builds its own message.
        super(message ?? `Cannot transition from ${from} to ${to}.`, options);
    }
}

export { InvalidStateTransitionException };
