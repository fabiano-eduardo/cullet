import { assertValidAggregateVersion } from "../shared/aggregate-version.js";
import { deepFreeze } from "../shared/immutable.js";
import { type ContractVersion } from "./version.js";

/** Anything carrying a `CONTRACT_VERSION` — a class decorated with `@version`. */
interface ContractVersioned {
    readonly CONTRACT_VERSION: ContractVersion;
}

/**
 * The classes whose contract version should be recorded on the envelope.
 *
 * Pass the **concrete** aggregate/value-object/use-case class (not the base),
 * so the envelope records the version the caller actually annotated with
 * `@version`. A base class handed here would report only the framework's
 * version, not the concrete shape that produced the event.
 */
interface DomainEventContractSelection {
    readonly entity?: ContractVersioned;
    readonly valueObject?: ContractVersioned;
    readonly useCase?: ContractVersioned;
}

// Wire-format shape: `snake_case` keys, deliberately distinct from the
// `camelCase` builder input above — these travel in the serialized event.
interface DomainEventContractVersions {
    readonly entity_contract?: ContractVersion;
    readonly value_object_contract?: ContractVersion;
    readonly use_case_contract?: ContractVersion;
}

type MutableContractVersions = {
    -readonly [K in keyof DomainEventContractVersions]: DomainEventContractVersions[K];
};

interface CreateDomainEventEnvelopeInput<TPayload> {
    readonly aggregateVersion: number;
    readonly payload: TPayload;
    readonly contracts: DomainEventContractSelection;
}

/**
 * A deliberately minimal domain-event envelope: it carries only the aggregate
 * version and the structural contract versions needed for state/event
 * migration. It intentionally omits `eventId`, `eventType`, `occurredAt` and
 * correlation ids — those require a clock/id source and belong to the
 * consumer's event infrastructure. Treat this as a versioning core to extend,
 * not a complete event record.
 */
interface DomainEventEnvelope<TPayload> extends DomainEventContractVersions {
    readonly aggregate_version: number;
    readonly payload: TPayload;
}

function buildDomainEventContractVersions(
    selection: DomainEventContractSelection,
): DomainEventContractVersions {
    const contractVersions: MutableContractVersions = {};

    if (selection.entity) {
        contractVersions.entity_contract = selection.entity.CONTRACT_VERSION;
    }

    if (selection.valueObject) {
        contractVersions.value_object_contract =
            selection.valueObject.CONTRACT_VERSION;
    }

    if (selection.useCase) {
        contractVersions.use_case_contract = selection.useCase.CONTRACT_VERSION;
    }

    return Object.freeze(contractVersions);
}

/**
 * Builds a frozen domain-event envelope. The whole envelope is deep-frozen,
 * so the `payload` handed in becomes immutable too — an event is an immutable
 * fact, and the caller must not mutate the payload after wrapping it.
 */
function createDomainEventEnvelope<TPayload>(
    input: CreateDomainEventEnvelopeInput<TPayload>,
): DomainEventEnvelope<TPayload> {
    assertValidAggregateVersion(input.aggregateVersion);

    return deepFreeze({
        aggregate_version: input.aggregateVersion,
        payload: input.payload,
        ...buildDomainEventContractVersions(input.contracts),
    });
}

export {
    buildDomainEventContractVersions,
    createDomainEventEnvelope,
    type ContractVersioned,
    type CreateDomainEventEnvelopeInput,
    type DomainEventContractSelection,
    type DomainEventContractVersions,
    type DomainEventEnvelope,
};
