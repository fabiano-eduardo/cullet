import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
    buildInstallCommand,
    detectPackageManager,
    formatInstallCommand,
} from "../../packages/cli/src/cli/utils/package-manager.js";

describe("detectPackageManager", () => {
    let cwd: string;

    beforeEach(async () => {
        cwd = await mkdtemp(join(tmpdir(), "cullet-pm-"));
    });

    afterEach(async () => {
        await rm(cwd, { recursive: true, force: true });
    });

    it("detects pnpm from pnpm-lock.yaml", async () => {
        await writeFile(join(cwd, "pnpm-lock.yaml"), "");
        expect(detectPackageManager(cwd)).toBe("pnpm");
    });

    it("detects yarn from yarn.lock", async () => {
        await writeFile(join(cwd, "yarn.lock"), "");
        expect(detectPackageManager(cwd)).toBe("yarn");
    });

    it("detects npm from package-lock.json", async () => {
        await writeFile(join(cwd, "package-lock.json"), "{}");
        expect(detectPackageManager(cwd)).toBe("npm");
    });

    it("falls back to npm when no lockfile is present", () => {
        expect(detectPackageManager(cwd)).toBe("npm");
    });

    it("prefers pnpm over yarn when both lockfiles exist", async () => {
        await writeFile(join(cwd, "pnpm-lock.yaml"), "");
        await writeFile(join(cwd, "yarn.lock"), "");
        expect(detectPackageManager(cwd)).toBe("pnpm");
    });
});

describe("buildInstallCommand", () => {
    it("uses `pnpm add` for pnpm", () => {
        expect(buildInstallCommand("pnpm", "@cullet/erp-core@1.0.0")).toEqual({
            command: "pnpm",
            args: ["add", "@cullet/erp-core@1.0.0"],
        });
    });

    it("uses `yarn add` for yarn", () => {
        expect(buildInstallCommand("yarn", "@cullet/erp-core@1.0.0")).toEqual({
            command: "yarn",
            args: ["add", "@cullet/erp-core@1.0.0"],
        });
    });

    it("uses `npm install` for npm", () => {
        expect(buildInstallCommand("npm", "@cullet/erp-core@1.0.0")).toEqual({
            command: "npm",
            args: ["install", "@cullet/erp-core@1.0.0"],
        });
    });
});

describe("formatInstallCommand", () => {
    it("renders a copy-pasteable command string", () => {
        expect(formatInstallCommand("pnpm", "@cullet/erp-core@1.0.0")).toBe(
            "pnpm add @cullet/erp-core@1.0.0",
        );
        expect(formatInstallCommand("npm", "@cullet/erp-core@1.0.0")).toBe(
            "npm install @cullet/erp-core@1.0.0",
        );
    });
});
