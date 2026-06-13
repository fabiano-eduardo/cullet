import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    printAliasOutcome,
    printExternalDepsWarning,
    printInstallPreview,
} from "../../packages/cli/src/cli/commands/full-control/output.js";
import { type FullControlContext } from "../../packages/cli/src/cli/commands/full-control/types.js";
import { type AliasUpdateResult } from "../../packages/cli/src/cli/utils/tsconfig.js";
import { type TelemetryCommandTracker } from "../../packages/cli/src/cli/utils/telemetry.js";

let logSpy: ReturnType<typeof vi.spyOn>;

function loggedOutput(): string {
    return logSpy.mock.calls
        .map((call: unknown[]) => call.join(" "))
        .join("\n");
}

function makeContext(
    overrides: Partial<FullControlContext> = {},
): FullControlContext {
    return {
        name: "erp-core",
        version: "1.0.0",
        npmName: "@cullet/erp-core",
        meta: null,
        installSpec: "@cullet/erp-core@1.0.0",
        alreadyInstalled: false,
        packageManager: "npm",
        options: {},
        tracker: { set: vi.fn() } as TelemetryCommandTracker,
        ...overrides,
    };
}

function makeAliasResult(
    overrides: Partial<AliasUpdateResult> = {},
): AliasUpdateResult {
    return {
        status: "created",
        alias: "@cullet/erp-core",
        target: "./cullet/erp-core@1.0.0/index.ts",
        ...overrides,
    };
}

beforeEach(() => {
    logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe("printExternalDepsWarning", () => {
    it("prints nothing when there are no dependencies", () => {
        printExternalDepsWarning([]);
        expect(logSpy).not.toHaveBeenCalled();
    });

    it("lists dependencies and the install command", () => {
        printExternalDepsWarning([
            { name: "zod", range: ">=4" },
            { name: "pino", range: "" },
            { name: "left-pad", range: ">=1 <2" },
        ]);

        const output = loggedOutput();
        expect(output).toContain("dependencias externas");
        // Range com espaco e citado; range vazio vira so o nome.
        expect(output).toContain('npm install zod@>=4 pino "left-pad@>=1 <2"');
    });
});

describe("printInstallPreview", () => {
    it("says nothing would be installed when already present", () => {
        printInstallPreview(makeContext({ alreadyInstalled: true }));
        expect(loggedOutput()).toContain("ja esta instalado");
    });

    it("warns when --no-install was used", () => {
        printInstallPreview(makeContext({ options: { install: false } }));
        expect(loggedOutput()).toContain("--no-install");
    });

    it("previews the install command otherwise", () => {
        printInstallPreview(makeContext());
        expect(loggedOutput()).toContain("Instalaria @cullet/erp-core@1.0.0");
    });
});

describe("printAliasOutcome", () => {
    it("warns when no tsconfig was found", () => {
        printAliasOutcome(makeAliasResult({ status: "missing-tsconfig" }), {
            dryRun: false,
        });
        expect(loggedOutput()).toContain("Nenhum tsconfig.json foi encontrado");
    });

    it("warns when the consumer has an explicit non-root baseUrl", () => {
        printAliasOutcome(
            makeAliasResult({
                status: "created",
                baseUrlWasExplicit: true,
                consumerBaseUrl: "./src",
            }),
            { dryRun: false },
        );

        const output = loggedOutput();
        expect(output).toContain('baseUrl do seu tsconfig esta como "./src"');
        expect(output).toContain("Alias criado");
    });

    it.each([
        ["unchanged", "ja esta correto"],
        ["updated", "seria atualizado"],
        ["created", "seria criado"],
    ] as const)("dry-run reports %s as %j", (status, label) => {
        printAliasOutcome(makeAliasResult({ status }), { dryRun: true });
        expect(loggedOutput()).toContain(`[dry-run] Alias ${label}`);
    });

    it.each([
        ["unchanged", "mantido"],
        ["updated", "atualizado"],
        ["created", "criado"],
    ] as const)("real run reports %s as %j", (status, label) => {
        printAliasOutcome(makeAliasResult({ status }), { dryRun: false });
        expect(loggedOutput()).toContain(`Alias ${label}`);
    });
});
