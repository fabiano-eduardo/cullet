import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
    buildInstallCommand,
    buildInstallInvocation,
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

describe("buildInstallInvocation", () => {
    it("enables the shell on Windows so .cmd shims can be spawned (CVE-2024-27980)", () => {
        expect(
            buildInstallInvocation("npm", "@cullet/erp-core@1.0.0", "win32"),
        ).toEqual({
            command: "npm",
            args: ["install", "@cullet/erp-core@1.0.0"],
            shell: true,
        });
    });

    it("keeps the shell off on POSIX platforms", () => {
        expect(
            buildInstallInvocation("pnpm", "@cullet/erp-core@1.0.0", "linux"),
        ).toEqual({
            command: "pnpm",
            args: ["add", "@cullet/erp-core@1.0.0"],
            shell: false,
        });
    });

    it("accepts a pinned semver with prerelease and build metadata", () => {
        expect(() =>
            buildInstallInvocation(
                "npm",
                "@scope/kit@1.2.3-beta.1+build.5",
                "win32",
            ),
        ).not.toThrow();
    });

    it("rejects specs carrying shell metacharacters", () => {
        for (const malicious of [
            "pkg && rm -rf /",
            "pkg; echo pwned",
            "pkg | cat",
            "pkg`whoami`",
            "pkg $(id)",
            "pkg with space",
        ]) {
            expect(() =>
                buildInstallInvocation("npm", malicious, "win32"),
            ).toThrow(/invalido/u);
        }
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
