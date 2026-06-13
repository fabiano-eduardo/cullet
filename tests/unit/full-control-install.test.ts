import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    ensureKitInstalled,
    runPostInstall,
} from "../../packages/cli/src/cli/commands/full-control/install.js";
import { installPackage } from "../../packages/cli/src/cli/utils/package-manager.js";
import { type FullControlContext } from "../../packages/cli/src/cli/commands/full-control/types.js";
import {
    type TelemetryCommandTracker,
    type TelemetryProperty,
} from "../../packages/cli/src/cli/utils/telemetry.js";

vi.mock("../../packages/cli/src/cli/utils/package-manager.js", async () => {
    const actual = await vi.importActual<
        typeof import("../../packages/cli/src/cli/utils/package-manager.js")
    >("../../packages/cli/src/cli/utils/package-manager.js");
    return { ...actual, installPackage: vi.fn() };
});

const installPackageMock = vi.mocked(installPackage);

function makeTracker() {
    const set =
        vi.fn<(name: string, value: TelemetryProperty | undefined) => void>();
    return { set } satisfies TelemetryCommandTracker;
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
        tracker: makeTracker(),
        ...overrides,
    };
}

beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
    vi.restoreAllMocks();
    installPackageMock.mockReset();
});

describe("ensureKitInstalled", () => {
    it("does nothing when the kit is already installed", async () => {
        await ensureKitInstalled(makeContext({ alreadyInstalled: true }));
        expect(installPackageMock).not.toHaveBeenCalled();
    });

    it("throws when the kit is missing and --no-install was used", async () => {
        const context = makeContext({ options: { install: false } });

        await expect(ensureKitInstalled(context)).rejects.toThrow(
            /--no-install/,
        );
        expect(installPackageMock).not.toHaveBeenCalled();
    });

    it("installs the kit and records it in the tracker", async () => {
        installPackageMock.mockResolvedValue(undefined);
        const tracker = makeTracker();
        const context = makeContext({ tracker });

        await ensureKitInstalled(context);

        expect(installPackageMock).toHaveBeenCalledWith(
            process.cwd(),
            "npm",
            "@cullet/erp-core@1.0.0",
        );
        expect(tracker.set).toHaveBeenCalledWith("installed", true);
    });

    it("wraps installation failures in a friendly error", async () => {
        installPackageMock.mockRejectedValue(new Error("rede fora"));

        await expect(ensureKitInstalled(makeContext())).rejects.toThrow(
            /Falha ao instalar @cullet\/erp-core@1\.0\.0/,
        );
    });
});

describe("runPostInstall", () => {
    let destination: string;

    beforeEach(async () => {
        destination = await mkdtemp(join(tmpdir(), "cullet-postinstall-"));
    });

    afterEach(async () => {
        await rm(destination, { recursive: true, force: true });
    });

    it("warns and skips when the declared script is missing", async () => {
        const tracker = makeTracker();

        await runPostInstall(destination, "setup.mjs", tracker);

        expect(tracker.set).not.toHaveBeenCalled();
    });

    it("executes the script and records it in the tracker", async () => {
        await writeFile(
            join(destination, "setup.mjs"),
            "import { writeFileSync } from 'node:fs';" +
                "writeFileSync('marker', 'ok');",
        );
        const tracker = makeTracker();

        await runPostInstall(destination, "setup.mjs", tracker);

        expect(existsSync(join(destination, "marker"))).toBe(true);
        expect(tracker.set).toHaveBeenCalledWith("postInstall", true);
    });

    it("wraps a failing script in a friendly error", async () => {
        await writeFile(join(destination, "setup.mjs"), "process.exit(1);");

        await expect(
            runPostInstall(destination, "setup.mjs", makeTracker()),
        ).rejects.toThrow(/Falha ao executar o postInstall/);
    });
});
