import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parse, printParseErrorCode, type ParseError } from "jsonc-parser";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { upsertPathAlias } from "../../packages/cli/src/cli/utils/tsconfig.js";

const ALIAS = "cullet/erp-core";
const TARGET = "./cullet/erp-core@1.0.0/index.ts";

let projectRoot: string;

beforeEach(async () => {
    projectRoot = await mkdtemp(join(tmpdir(), "cullet-upsert-"));
});

afterEach(async () => {
    await rm(projectRoot, { recursive: true, force: true });
});

async function readTsconfigJson(): Promise<Record<string, unknown>> {
    const raw = await readFile(join(projectRoot, "tsconfig.json"), "utf8");
    const errors: ParseError[] = [];
    const parsed = parse(raw, errors, { allowTrailingComma: true }) as unknown;

    if (errors.length > 0) {
        throw new Error(
            `Invalid JSONC in test fixture: ${printParseErrorCode(errors[0].error)}`,
        );
    }

    return parsed as Record<string, unknown>;
}

describe("upsertPathAlias", () => {
    it("returns missing-tsconfig when no tsconfig.json exists", async () => {
        const result = await upsertPathAlias(projectRoot, ALIAS, TARGET);
        expect(result.status).toBe("missing-tsconfig");
        expect(result.alias).toBe(ALIAS);
        expect(result.target).toBe(TARGET);
        expect(result.tsconfigPath).toBeUndefined();
    });

    it("creates compilerOptions when the tsconfig has none", async () => {
        await writeFile(
            join(projectRoot, "tsconfig.json"),
            JSON.stringify({ include: ["src/**/*"] }, null, 2),
        );

        const result = await upsertPathAlias(projectRoot, ALIAS, TARGET);

        expect(result.status).toBe("created");
        expect(result.baseUrlWasExplicit).toBe(false);
        expect(result.consumerBaseUrl).toBe(".");

        const written = await readTsconfigJson();
        const compilerOptions = written.compilerOptions as Record<
            string,
            unknown
        >;
        expect(compilerOptions.baseUrl).toBe(".");
        expect(compilerOptions.paths).toEqual({ [ALIAS]: [TARGET] });
    });

    it("creates the paths object when it is missing", async () => {
        await writeFile(
            join(projectRoot, "tsconfig.json"),
            JSON.stringify({ compilerOptions: { strict: true } }, null, 2),
        );

        const result = await upsertPathAlias(projectRoot, ALIAS, TARGET);

        expect(result.status).toBe("created");
        const written = await readTsconfigJson();
        const compilerOptions = written.compilerOptions as Record<
            string,
            unknown
        >;
        expect(compilerOptions.strict).toBe(true);
        expect(compilerOptions.paths).toEqual({ [ALIAS]: [TARGET] });
    });

    it("preserves baseUrl when explicit and not equal to .", async () => {
        await writeFile(
            join(projectRoot, "tsconfig.json"),
            JSON.stringify(
                { compilerOptions: { baseUrl: "./src", paths: {} } },
                null,
                2,
            ),
        );

        const result = await upsertPathAlias(projectRoot, ALIAS, TARGET);

        expect(result.status).toBe("created");
        expect(result.baseUrlWasExplicit).toBe(true);
        expect(result.consumerBaseUrl).toBe("./src");

        const written = await readTsconfigJson();
        const compilerOptions = written.compilerOptions as Record<
            string,
            unknown
        >;
        expect(compilerOptions.baseUrl).toBe("./src");
    });

    it("returns unchanged when the alias already points to the same target", async () => {
        await writeFile(
            join(projectRoot, "tsconfig.json"),
            JSON.stringify(
                {
                    compilerOptions: {
                        baseUrl: ".",
                        paths: { [ALIAS]: [TARGET] },
                    },
                },
                null,
                2,
            ),
        );

        const before = await readFile(
            join(projectRoot, "tsconfig.json"),
            "utf8",
        );
        const result = await upsertPathAlias(projectRoot, ALIAS, TARGET);
        const after = await readFile(
            join(projectRoot, "tsconfig.json"),
            "utf8",
        );

        expect(result.status).toBe("unchanged");
        expect(after).toBe(before);
    });

    it("updates the alias when it points to a different target", async () => {
        await writeFile(
            join(projectRoot, "tsconfig.json"),
            JSON.stringify(
                {
                    compilerOptions: {
                        baseUrl: ".",
                        paths: { [ALIAS]: ["./old-path/index.ts"] },
                    },
                },
                null,
                2,
            ),
        );

        const result = await upsertPathAlias(projectRoot, ALIAS, TARGET);

        expect(result.status).toBe("updated");
        const written = await readTsconfigJson();
        const compilerOptions = written.compilerOptions as Record<
            string,
            unknown
        >;
        expect(compilerOptions.paths).toEqual({ [ALIAS]: [TARGET] });
    });

    it("preserves other aliases in the paths map", async () => {
        await writeFile(
            join(projectRoot, "tsconfig.json"),
            JSON.stringify(
                {
                    compilerOptions: {
                        baseUrl: ".",
                        paths: { "@/*": ["src/*"] },
                    },
                },
                null,
                2,
            ),
        );

        await upsertPathAlias(projectRoot, ALIAS, TARGET);

        const written = await readTsconfigJson();
        const compilerOptions = written.compilerOptions as Record<
            string,
            unknown
        >;
        expect(compilerOptions.paths).toEqual({
            "@/*": ["src/*"],
            [ALIAS]: [TARGET],
        });
    });

    it("parses tsconfig.json with line and block comments (JSONC)", async () => {
        const jsonc = `{
      // Project root tsconfig
      "compilerOptions": {
        /* base options */
        "baseUrl": ".",
        "paths": {}
      }
    }`;
        await writeFile(join(projectRoot, "tsconfig.json"), jsonc);

        const result = await upsertPathAlias(projectRoot, ALIAS, TARGET);

        expect(result.status).toBe("created");
        const raw = await readFile(join(projectRoot, "tsconfig.json"), "utf8");
        expect(raw).toContain("// Project root tsconfig");
        expect(raw).toContain("/* base options */");
        const written = await readTsconfigJson();
        const compilerOptions = written.compilerOptions as Record<
            string,
            unknown
        >;
        expect(compilerOptions.paths).toEqual({ [ALIAS]: [TARGET] });
    });

    it("preserves the existing indentation style when writing aliases", async () => {
        const jsonc = `{
	"compilerOptions": {
		"baseUrl": ".",
		"paths": {}
	}
}`;
        await writeFile(join(projectRoot, "tsconfig.json"), jsonc);

        const result = await upsertPathAlias(projectRoot, ALIAS, TARGET);

        expect(result.status).toBe("created");
        const raw = await readFile(join(projectRoot, "tsconfig.json"), "utf8");
        expect(raw).toMatch(/^\t\t\t"cullet\/erp-core":/mu);
    });

    it("preserves four-space indentation when writing aliases", async () => {
        const jsonc = `{
    "compilerOptions": {
        "baseUrl": ".",
        "paths": {}
    }
}`;
        await writeFile(join(projectRoot, "tsconfig.json"), jsonc);

        const result = await upsertPathAlias(projectRoot, ALIAS, TARGET);

        expect(result.status).toBe("created");
        const raw = await readFile(join(projectRoot, "tsconfig.json"), "utf8");
        expect(raw).toMatch(/^ {12}"cullet\/erp-core":/mu);
    });

    it("parses tsconfig.json with trailing commas", async () => {
        const withTrailingCommas = `{
      "compilerOptions": {
        "baseUrl": ".",
        "paths": {
          "@/*": ["src/*"],
        },
      },
    }`;
        await writeFile(join(projectRoot, "tsconfig.json"), withTrailingCommas);

        const result = await upsertPathAlias(projectRoot, ALIAS, TARGET);

        expect(result.status).toBe("created");
        const written = await readTsconfigJson();
        const compilerOptions = written.compilerOptions as Record<
            string,
            unknown
        >;
        expect(compilerOptions.paths).toEqual({
            "@/*": ["src/*"],
            [ALIAS]: [TARGET],
        });
    });

    it("supports the dryRun option without touching the disk", async () => {
        const original = JSON.stringify(
            { compilerOptions: { baseUrl: ".", paths: {} } },
            null,
            2,
        );
        await writeFile(join(projectRoot, "tsconfig.json"), original);

        const result = await upsertPathAlias(projectRoot, ALIAS, TARGET, {
            dryRun: true,
        });

        expect(result.status).toBe("created");
        const after = await readFile(
            join(projectRoot, "tsconfig.json"),
            "utf8",
        );
        expect(after).toBe(original);
    });

    it("throws when baseUrl has the wrong type", async () => {
        await writeFile(
            join(projectRoot, "tsconfig.json"),
            JSON.stringify({ compilerOptions: { baseUrl: 42 } }),
        );

        await expect(
            upsertPathAlias(projectRoot, ALIAS, TARGET),
        ).rejects.toThrow(/baseUrl.*string/);
    });

    it("throws when compilerOptions is not an object", async () => {
        await writeFile(
            join(projectRoot, "tsconfig.json"),
            JSON.stringify({ compilerOptions: "nope" }),
        );

        await expect(
            upsertPathAlias(projectRoot, ALIAS, TARGET),
        ).rejects.toThrow(/compilerOptions.*objeto/);
    });
});
