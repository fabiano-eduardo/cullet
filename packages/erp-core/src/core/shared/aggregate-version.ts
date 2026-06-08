import { InvariantViolationException } from "../exceptions/invariant-violation-exception";

function assertValidAggregateVersion(aggregateVersion: number): void {
    if (!Number.isInteger(aggregateVersion) || aggregateVersion < 0) {
        throw new InvariantViolationException(
            `aggregateVersion must be a non-negative integer. Received: ${aggregateVersion}`,
        );
    }
}

export { assertValidAggregateVersion };
