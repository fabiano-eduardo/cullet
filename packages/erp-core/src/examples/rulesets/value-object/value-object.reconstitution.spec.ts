import { describe, expect, it } from "vitest";

import { CPF } from "./cpf";
import { PersonName } from "./person-name";

describe("CPF reconstitution", () => {
    it("does not re-validate a historical CPF that would fail current rules", () => {
        expect(() =>
            CPF.reconstitute("00000000000", "cpf-rules@0.9"),
        ).not.toThrow();
    });

    it("preserves the appliedRulesetId exactly as persisted", () => {
        const cpf = CPF.reconstitute("00000000000", "cpf-rules@0.9");

        expect(cpf.value).toBe("00000000000");
        expect(cpf.appliedRulesetId).toBe("cpf-rules@0.9");
    });
});

describe("PersonName reconstitution", () => {
    it("does not re-validate a historical name that would fail current rules", () => {
        expect(() =>
            PersonName.reconstitute("", "person-name-rules@0.9"),
        ).not.toThrow();
    });

    it("preserves the appliedRulesetId exactly as persisted", () => {
        const name = PersonName.reconstitute("", "person-name-rules@0.9");

        expect(name.value).toBe("");
        expect(name.appliedRulesetId).toBe("person-name-rules@0.9");
    });
});
