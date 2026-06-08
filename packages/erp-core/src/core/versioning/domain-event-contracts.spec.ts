import { describe, expect, it, vi } from "vitest";

vi.mock("../application/use-case", () => ({
    UseCase: { CONTRACT_VERSION: "1.0" },
}));

import { InvariantViolationException } from "../exceptions/invariant-violation-exception";
import {
    buildDomainEventContractVersions,
    createDomainEventEnvelope,
} from "./domain-event-contracts";

describe("buildDomainEventContractVersions()", () => {
    it("returns an empty object when no selection is made", () => {
        const result = buildDomainEventContractVersions({});

        expect(result).toEqual({});
    });

    it("includes entity_contract when entity is true", () => {
        const result = buildDomainEventContractVersions({ entity: true });

        expect(result).toHaveProperty("entity_contract");
        expect(typeof result.entity_contract).toBe("string");
    });

    it("includes value_object_contract when valueObject is true", () => {
        const result = buildDomainEventContractVersions({ valueObject: true });

        expect(result).toHaveProperty("value_object_contract");
        expect(typeof result.value_object_contract).toBe("string");
    });

    it("includes use_case_contract when useCase is true", () => {
        const result = buildDomainEventContractVersions({ useCase: true });

        expect(result).toHaveProperty("use_case_contract");
        expect(typeof result.use_case_contract).toBe("string");
    });

    it("includes every contract when all selections are true", () => {
        const result = buildDomainEventContractVersions({
            entity: true,
            valueObject: true,
            useCase: true,
        });

        expect(result).toHaveProperty("entity_contract");
        expect(result).toHaveProperty("value_object_contract");
        expect(result).toHaveProperty("use_case_contract");
    });

    it("does not include entity_contract when entity is false", () => {
        const result = buildDomainEventContractVersions({ entity: false });

        expect(result).not.toHaveProperty("entity_contract");
    });

    it("does not include value_object_contract when valueObject is false", () => {
        const result = buildDomainEventContractVersions({ valueObject: false });

        expect(result).not.toHaveProperty("value_object_contract");
    });

    it("does not include use_case_contract when useCase is false", () => {
        const result = buildDomainEventContractVersions({ useCase: false });

        expect(result).not.toHaveProperty("use_case_contract");
    });

    it("returns a frozen object", () => {
        const result = buildDomainEventContractVersions({});

        expect(Object.isFrozen(result)).toBe(true);
    });

    it("includes only entity_contract when only entity is true", () => {
        const result = buildDomainEventContractVersions({
            entity: true,
            valueObject: false,
            useCase: false,
        });

        expect(result).toHaveProperty("entity_contract");
        expect(result).not.toHaveProperty("value_object_contract");
        expect(result).not.toHaveProperty("use_case_contract");
    });
});

describe("createDomainEventEnvelope()", () => {
    it("creates an envelope with the correct aggregateVersion and payload", () => {
        const payload = { userId: "u-1", action: "CREATED" };
        const envelope = createDomainEventEnvelope({
            aggregateVersion: 1,
            payload,
            contracts: {},
        });

        expect(envelope.aggregate_version).toBe(1);
        expect(envelope.payload).toEqual(payload);
    });

    it("includes contracts in the envelope when selected", () => {
        const envelope = createDomainEventEnvelope({
            aggregateVersion: 0,
            payload: {},
            contracts: { entity: true, valueObject: true },
        });

        expect(envelope).toHaveProperty("entity_contract");
        expect(envelope).toHaveProperty("value_object_contract");
    });

    it("returns a frozen envelope", () => {
        const envelope = createDomainEventEnvelope({
            aggregateVersion: 0,
            payload: {},
            contracts: {},
        });

        expect(Object.isFrozen(envelope)).toBe(true);
    });

    it("accepts aggregateVersion zero", () => {
        const envelope = createDomainEventEnvelope({
            aggregateVersion: 0,
            payload: { ok: true },
            contracts: {},
        });

        expect(envelope.aggregate_version).toBe(0);
    });

    it("throws InvariantViolationException when aggregateVersion is negative", () => {
        expect(() =>
            createDomainEventEnvelope({
                aggregateVersion: -1,
                payload: {},
                contracts: {},
            }),
        ).toThrow(InvariantViolationException);
    });

    it("throws InvariantViolationException when aggregateVersion is not an integer", () => {
        expect(() =>
            createDomainEventEnvelope({
                aggregateVersion: 1.5,
                payload: {},
                contracts: {},
            }),
        ).toThrow(InvariantViolationException);
    });

    it("includes the correct message in the invariant violation for invalid aggregateVersion", () => {
        expect(() =>
            createDomainEventEnvelope({
                aggregateVersion: -5,
                payload: {},
                contracts: {},
            }),
        ).toThrow("aggregateVersion must be a non-negative integer");
    });

    it("accepts a payload of any type", () => {
        const primitiveEnvelope = createDomainEventEnvelope({
            aggregateVersion: 1,
            payload: 42,
            contracts: {},
        });
        expect(primitiveEnvelope.payload).toBe(42);

        const arrayEnvelope = createDomainEventEnvelope({
            aggregateVersion: 1,
            payload: [1, 2, 3],
            contracts: {},
        });
        expect(arrayEnvelope.payload).toEqual([1, 2, 3]);
    });
});
