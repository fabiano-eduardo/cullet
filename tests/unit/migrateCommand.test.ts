import { describe, expect, it } from "vitest";
import { createMigrateCommand } from "../../cli/commands/migrate.js";

describe("createMigrateCommand", () => {
    it("documents that codemod flags execute kit code", () => {
        const help = createMigrateCommand()
            .helpInformation()
            .replace(/\s+/g, " ");

        expect(help).toContain("roda codigo do kit");
        expect(help).toContain("tambem executa o codigo do kit");
    });
});
