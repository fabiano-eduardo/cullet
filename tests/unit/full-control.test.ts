import fs from "fs-extra";
import { mkdtemp, readdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { copyDirectoryTransactional } from "../../cli/commands/full-control.js";

async function makeFixtureRoot(): Promise<string> {
  return mkdtemp(join(tmpdir(), "cullet-fc-"));
}

async function writeTextFile(path: string, content: string): Promise<void> {
  await fs.ensureDir(dirname(path));
  await writeFile(path, content, "utf8");
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("copyDirectoryTransactional", () => {
  it("preserves the existing destination when staging the copy fails", async () => {
    const root = await makeFixtureRoot();
    const sourceDir = join(root, "source");
    const destinationDir = join(root, "cullet", "erp-core@1.0.0");

    await writeTextFile(
      join(sourceDir, "index.ts"),
      "export const version = 'new';\n"
    );
    await writeTextFile(
      join(destinationDir, "index.ts"),
      "export const version = 'old';\n"
    );
    await writeTextFile(join(destinationDir, "__sentinel__"), "keep me\n");

    vi.spyOn(fs, "copy").mockRejectedValueOnce(new Error("copy failed"));

    await expect(
      copyDirectoryTransactional(sourceDir, destinationDir)
    ).rejects.toThrow(/Falha ao preparar a copia/);

    await expect(
      readFile(join(destinationDir, "index.ts"), "utf8")
    ).resolves.toContain("old");
    await expect(
      readFile(join(destinationDir, "__sentinel__"), "utf8")
    ).resolves.toContain("keep me");
    await expect(readdir(join(root, "cullet"))).resolves.toEqual([
      "erp-core@1.0.0",
    ]);
  });

  it("restores the backup when the final swap fails", async () => {
    const root = await makeFixtureRoot();
    const sourceDir = join(root, "source");
    const destinationDir = join(root, "cullet", "erp-core@1.0.0");

    await writeTextFile(
      join(sourceDir, "index.ts"),
      "export const version = 'new';\n"
    );
    await writeTextFile(
      join(destinationDir, "index.ts"),
      "export const version = 'old';\n"
    );
    await writeTextFile(join(destinationDir, "__sentinel__"), "keep me\n");

    const actualMove = fs.move.bind(fs) as typeof fs.move;
    let moveCalls = 0;

    vi.spyOn(fs, "move").mockImplementation(
      async (...args: Parameters<typeof fs.move>) => {
        moveCalls += 1;
        if (moveCalls === 2) {
          throw new Error("swap failed");
        }
        return actualMove(...args);
      }
    );

    await expect(
      copyDirectoryTransactional(sourceDir, destinationDir)
    ).rejects.toThrow(/O conteudo anterior foi preservado/);

    await expect(
      readFile(join(destinationDir, "index.ts"), "utf8")
    ).resolves.toContain("old");
    await expect(
      readFile(join(destinationDir, "__sentinel__"), "utf8")
    ).resolves.toContain("keep me");
    await expect(readdir(join(root, "cullet"))).resolves.toEqual([
      "erp-core@1.0.0",
    ]);
  });
});
