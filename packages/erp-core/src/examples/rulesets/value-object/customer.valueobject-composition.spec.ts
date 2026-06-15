import { describe, expect, it } from "vitest";

import { CPFRulesV1 } from "./cpf-rules-v1.js";
import {
    Customer,
    type CustomerCreateData,
    type CustomerSnapshot,
} from "./customer.js";
import { PersonNameRulesV2 } from "./person-name-rules-v2.js";

function makeCustomerCreateData(
    overrides: Partial<CustomerCreateData> = {},
): CustomerCreateData {
    return {
        cpf: "52998224725",
        name: "Anne-Marie Smith",
        ...overrides,
    };
}

function makeCustomerSnapshot(
    overrides: Partial<CustomerSnapshot> = {},
): CustomerSnapshot {
    return {
        cpf_value: "00000000000",
        cpf_ruleset: "cpf-rules@1.0",
        name_value: "A",
        name_ruleset: "person-name-rules@1.0",
        ...overrides,
    };
}

describe("Customer value object composition", () => {
    it("exposes the appliedRulesetIds of the value objects used at creation", () => {
        const customer = Customer.create(makeCustomerCreateData(), {
            cpf: new CPFRulesV1(),
            name: new PersonNameRulesV2(),
        });

        expect(customer.cpf.appliedRulesetId).toBe("cpf-rules@1.0");
        expect(customer.name.appliedRulesetId).toBe("person-name-rules@2.0");
    });

    it("preserves the original appliedRulesetId of child value objects on reconstitution", () => {
        const customer = Customer.reconstitute(makeCustomerSnapshot());

        expect(customer.cpf.appliedRulesetId).toBe("cpf-rules@1.0");
        expect(customer.name.appliedRulesetId).toBe("person-name-rules@1.0");
    });

    it("does not re-validate child value objects when reconstituting from storage", () => {
        expect(() =>
            Customer.reconstitute(
                makeCustomerSnapshot({
                    cpf_value: "00000000000",
                    name_value: "A",
                }),
            ),
        ).not.toThrow();
    });
});
