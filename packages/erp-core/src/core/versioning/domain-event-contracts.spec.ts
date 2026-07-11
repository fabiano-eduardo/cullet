import { describe, expect, it } from "vitest";

import { InvariantViolationException } from "../exceptions/invariant-violation-exception.js";
import {
    buildDomainEventContractVersions,
    createDomainEventEnvelope,
} from "./domain-event-contracts.js";
import { type ContractVersion, version } from "./version.js";

// Real `@version`-decorated classes (no mocks — honors the kit's
// `vitest-no-mocks-in-core` style). Distinct versions prove the envelope
// reports the concrete class's version, not a framework base's.
@version("2.0")
class OrderEntity {
    static readonly CONTRACT_VERSION: ContractVersion;
}

@version("3.1")
class Money {
    static readonly CONTRACT_VERSION: ContractVersion;
}

@version("4.2")
class PlaceOrder {
    static readonly CONTRACT_VERSION: ContractVersion;
}

describe("buildDomainEventContractVersions()", () => {
    it("returns an empty object when no selection is made", () => {
        const result = buildDomainEventContractVersions({});

        expect(result).toEqual({});
    });

    it("records the concrete entity's contract version", () => {
        const result = buildDomainEventContractVersions({ entity: OrderEntity });

        expect(result.entity_contract).toBe("2.0");
    });

    it("records the concrete value object's contract version", () => {
        const result = buildDomainEventContractVersions({ valueObject: Money });

        expect(result.value_object_contract).toBe("3.1");
    });

    it("records the concrete use case's contract version", () => {
        const result = buildDomainEventContractVersions({ useCase: PlaceOrder });

        expect(result.use_case_contract).toBe("4.2");
    });

    it("records every contract when all are selected", () => {
        const result = buildDomainEventContractVersions({
            entity: OrderEntity,
            valueObject: Money,
            useCase: PlaceOrder,
        });

        expect(result).toEqual({
            entity_contract: "2.0",
            value_object_contract: "3.1",
            use_case_contract: "4.2",
        });
    });

    it("omits contracts that are not selected", () => {
        const result = buildDomainEventContractVersions({ entity: OrderEntity });

        expect(result).not.toHaveProperty("value_object_contract");
        expect(result).not.toHaveProperty("use_case_contract");
    });

    it("returns a frozen object", () => {
        const result = buildDomainEventContractVersions({});

        expect(Object.isFrozen(result)).toBe(true);
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

    it("includes the concrete contract versions when selected", () => {
        const envelope = createDomainEventEnvelope({
            aggregateVersion: 0,
            payload: {},
            contracts: { entity: OrderEntity, valueObject: Money },
        });

        expect(envelope.entity_contract).toBe("2.0");
        expect(envelope.value_object_contract).toBe("3.1");
    });

    it("returns a frozen envelope", () => {
        const envelope = createDomainEventEnvelope({
            aggregateVersion: 0,
            payload: {},
            contracts: {},
        });

        expect(Object.isFrozen(envelope)).toBe(true);
    });

    it("deep-freezes the payload so it cannot be mutated after wrapping", () => {
        const payload = { total: 10 };
        const envelope = createDomainEventEnvelope({
            aggregateVersion: 1,
            payload,
            contracts: {},
        });

        expect(Object.isFrozen(envelope.payload)).toBe(true);
        expect(() => {
            (envelope.payload as { total: number }).total = 999;
        }).toThrow(TypeError);
        expect(envelope.payload.total).toBe(10);
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
