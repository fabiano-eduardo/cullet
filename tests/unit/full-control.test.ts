import fs from "fs-extra";
import { mkdtemp, readdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  copyDirectoryTransactional,
  findPayloadConflicts,
  listRelativeFiles,
} from "../../packages/cli/src/cli/commands/full-control.js";

async function makeFixtureRoot(): Promise<string> {
  return mkdtemp(join(tmpdir(), "cullet-fc-"));
}

async function writeTree(
  root: string,
  files: Record<string, string>,
): Promise<void> {
  for (const [rel, content] of Object.entries(files)) {
    const path = join(root, rel);
    await fs.ensureDir(dirname(path));
    await writeFile(path, content, "utf8");
  }
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
      "export const version = 'new';\n",
    );
    await writeTextFile(
      join(destinationDir, "index.ts"),
      "export const version = 'old';\n",
    );
    await writeTextFile(join(destinationDir, "__sentinel__"), "keep me\n");

    vi.spyOn(fs, "copy").mockRejectedValueOnce(new Error("copy failed"));

    await expect(
      copyDirectoryTransactional(sourceDir, destinationDir),
    ).rejects.toThrow(/Falha ao preparar a copia/);

    await expect(
      readFile(join(destinationDir, "index.ts"), "utf8"),
    ).resolves.toContain("old");
    await expect(
      readFile(join(destinationDir, "__sentinel__"), "utf8"),
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
      "export const version = 'new';\n",
    );
    await writeTextFile(
      join(destinationDir, "index.ts"),
      "export const version = 'old';\n",
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
      },
    );

    await expect(
      copyDirectoryTransactional(sourceDir, destinationDir),
    ).rejects.toThrow(/O conteudo anterior foi preservado/);

    await expect(
      readFile(join(destinationDir, "index.ts"), "utf8"),
    ).resolves.toContain("old");
    await expect(
      readFile(join(destinationDir, "__sentinel__"), "utf8"),
    ).resolves.toContain("keep me");
    await expect(readdir(join(root, "cullet"))).resolves.toEqual([
      "erp-core@1.0.0",
    ]);
  });
});

describe("listRelativeFiles", () => {
  it("enumerates nested files relative to the root", async () => {
    const root = await makeFixtureRoot();
    await writeTree(root, {
      "CLAUDE.md": "a",
      "hooks/pre.mjs": "b",
      "agents/reviewer/agent.md": "c",
    });

    const files = (await listRelativeFiles(root)).map((path) =>
      path.split("\\").join("/"),
    );

    expect(files.sort()).toEqual([
      "CLAUDE.md",
      "agents/reviewer/agent.md",
      "hooks/pre.mjs",
    ]);
  });

  it("returns an empty list for a missing root", async () => {
    const root = await makeFixtureRoot();
    await expect(listRelativeFiles(join(root, "nope"))).resolves.toEqual([]);
  });
});

describe("findPayloadConflicts", () => {
  it("reports only payload files that already exist at the destination", async () => {
    const root = await makeFixtureRoot();
    const sourceDir = join(root, "files");
    const destinationDir = join(root, ".claude");

    await writeTree(sourceDir, {
      "CLAUDE.md": "from kit",
      "hooks/pre.mjs": "from kit",
    });
    // Destination already has one of the payload files plus an unrelated file.
    await writeTree(destinationDir, {
      "CLAUDE.md": "user's own",
      "settings.json": "{}",
    });

    const conflicts = (
      await findPayloadConflicts(sourceDir, destinationDir)
    ).map((path) => path.split("\\").join("/"));

    expect(conflicts).toEqual(["CLAUDE.md"]);
  });

  it("reports no conflicts when the destination does not exist", async () => {
    const root = await makeFixtureRoot();
    const sourceDir = join(root, "files");
    await writeTree(sourceDir, { "CLAUDE.md": "from kit" });

    await expect(
      findPayloadConflicts(sourceDir, join(root, ".claude")),
    ).resolves.toEqual([]);
  });
});
