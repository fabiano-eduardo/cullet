import { UseCase } from "../application/use-case.js";
import { Entity } from "../domain/entity.js";
import { ValueObject } from "../domain/value-object.js";
import { assertValidAggregateVersion } from "../shared/aggregate-version.js";
import { type ContractVersion } from "./version.js";

interface DomainEventContractSelection {
    readonly entity?: boolean;
    readonly valueObject?: boolean;
    readonly useCase?: boolean;
}

interface DomainEventContractVersions {
    readonly entity_contract?: ContractVersion;
    readonly value_object_contract?: ContractVersion;
    readonly use_case_contract?: ContractVersion;
}

interface CreateDomainEventEnvelopeInput<TPayload> {
    readonly aggregateVersion: number;
    readonly payload: TPayload;
    readonly contracts: DomainEventContractSelection;
}

interface DomainEventEnvelope<TPayload> extends DomainEventContractVersions {
    readonly aggregate_version: number;
    readonly payload: TPayload;
}

function buildDomainEventContractVersions(
    selection: DomainEventContractSelection,
): DomainEventContractVersions {
    const contractVersions: {
        entity_contract?: ContractVersion;
        value_object_contract?: ContractVersion;
        use_case_contract?: ContractVersion;
    } = {};

    if (selection.entity) {
        contractVersions.entity_contract = Entity.CONTRACT_VERSION;
    }

    if (selection.valueObject) {
        contractVersions.value_object_contract = ValueObject.CONTRACT_VERSION;
    }

    if (selection.useCase) {
        contractVersions.use_case_contract = UseCase.CONTRACT_VERSION;
    }

    return Object.freeze(contractVersions);
}

function createDomainEventEnvelope<TPayload>(
    input: CreateDomainEventEnvelopeInput<TPayload>,
): DomainEventEnvelope<TPayload> {
    assertValidAggregateVersion(input.aggregateVersion);

    return Object.freeze({
        aggregate_version: input.aggregateVersion,
        payload: input.payload,
        ...buildDomainEventContractVersions(input.contracts),
    });
}

export {
    buildDomainEventContractVersions,
    createDomainEventEnvelope,
    type CreateDomainEventEnvelopeInput,
    type DomainEventContractSelection,
    type DomainEventContractVersions,
    type DomainEventEnvelope,
};
