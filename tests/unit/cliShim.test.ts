import { rename } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";

const originalExitCode = process.exitCode;

async function importCliShim(tag: string): Promise<void> {
    const moduleUrl = new URL(
        `../../packages/cli/index.js?${tag}`,
        import.meta.url,
    );
    await import(/* @vite-ignore */ moduleUrl.href);
}

afterEach(() => {
    process.exitCode = originalExitCode;
    vi.restoreAllMocks();
    vi.resetModules();
});

describe("cli shim", () => {
    it("reports dist entry failures through stderr and exitCode", async () => {
        process.exitCode = 0;
        let stderrOutput = "";
        const stderrSpy = vi
            .spyOn(process.stderr, "write")
            .mockImplementation((value) => {
                stderrOutput += String(value);
                return true;
            });

        const distEntryPath = fileURLToPath(
            new URL("../../packages/cli/dist/cli/index.js", import.meta.url),
        );
        const distEntryBackupPath = `${distEntryPath}.bak-test`;

        await rename(distEntryPath, distEntryBackupPath);

        try {
            await importCliShim("dist-entry-error");
            await expect.poll(() => process.exitCode).toBe(1);
        } finally {
            await rename(distEntryBackupPath, distEntryPath);
        }

        expect(process.exitCode).toBe(1);
        expect(stderrSpy).toHaveBeenCalled();
        expect(stderrOutput).toContain("dist/cli/index.js");
    });
});
