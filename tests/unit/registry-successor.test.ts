import { describe, expect, it } from "vitest";
import {
    describeKitSuccessor,
    formatKitSuccessor,
} from "../../packages/cli/src/registry/successor.js";

describe("formatKitSuccessor", () => {
    it("formats the successor as nome@versao", () => {
        expect(formatKitSuccessor({ name: "erp-core", version: "2.0.0" })).toBe(
            "erp-core@2.0.0",
        );
    });
});

describe("describeKitSuccessor", () => {
    it("describes a minimal successor with a single line", () => {
        expect(
            describeKitSuccessor({ name: "erp-core", version: "2.0.0" }),
        ).toEqual(["Sucessor recomendado: erp-core@2.0.0"]);
    });

    it("includes the migration guide when declared", () => {
        const lines = describeKitSuccessor({
            name: "erp-core",
            version: "2.0.0",
            guide: "MIGRATION.md",
        });

        expect(lines).toContain("Guia de migracao: MIGRATION.md");
    });

    it("describes a codemod by path when it has no description", () => {
        const lines = describeKitSuccessor({
            name: "erp-core",
            version: "2.0.0",
            codemod: { path: "codemods/up.mjs" },
        });

        expect(lines).toContain("Codemod disponivel: codemods/up.mjs");
    });

    it("describes a codemod with description and path", () => {
        const lines = describeKitSuccessor({
            name: "erp-core",
            version: "2.0.0",
            codemod: { path: "codemods/up.mjs", description: "Renomeia API" },
        });

        expect(lines).toContain(
            "Codemod disponivel: Renomeia API (codemods/up.mjs)",
        );
    });

    it("includes migration notes when declared", () => {
        const lines = describeKitSuccessor({
            name: "erp-core",
            version: "2.0.0",
            notes: "Atualize os imports.",
        });

        expect(lines).toContain("Notas de migracao: Atualize os imports.");
    });
});
