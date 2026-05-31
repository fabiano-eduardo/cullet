import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

let tempRoot: string;
let importCounter = 0;

class ExitSignal extends Error {
  constructor(readonly code: number | undefined) {
    super(`process.exit(${code})`);
  }
}

async function importFresh(relativePath: string): Promise<void> {
  const scriptUrl = new URL(`../../${relativePath}`, import.meta.url);
  scriptUrl.searchParams.set("t", String((importCounter += 1)));
  await import(/* @vite-ignore */ scriptUrl.href);
}

async function waitUntil(
  assertion: () => void | Promise<void>,
  timeoutMs = 10_000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    try {
      await assertion();
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }

  await assertion();
}

async function runScriptExpectExit(
  relativePath: string,
  args: string[],
): Promise<number | undefined> {
  const previousArgv = [...process.argv];
  const exitSpy = vi.spyOn(process, "exit").mockImplementation(((
    code?: number,
  ) => {
    throw new ExitSignal(code);
  }) as never);
  const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

  process.argv = ["node", join(repoRoot, relativePath), ...args];

  try {
    await importFresh(relativePath);
  } catch (error) {
    if (error instanceof ExitSignal) {
      return error.code;
    }
    throw error;
  } finally {
    process.argv = previousArgv;
    exitSpy.mockRestore();
    logSpy.mockRestore();
    errorSpy.mockRestore();
  }

  throw new Error(`${relativePath} did not call process.exit()`);
}

async function runValidateKitAsScript(args: string[] = []): Promise<number[]> {
  const previousArgv = [...process.argv];
  const exitCodes: number[] = [];
  const exitSpy = vi.spyOn(process, "exit").mockImplementation(((
    code?: number,
  ) => {
    exitCodes.push(code ?? 0);
    return undefined as never;
  }) as never);
  const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

  process.argv = [
    "node",
    join(repoRoot, "scripts", "validate-kit.mjs"),
    ...args,
  ];

  try {
    await importFresh("scripts/validate-kit.mjs");
    await waitUntil(() => {
      expect(exitCodes).toHaveLength(1);
    });
    return exitCodes;
  } finally {
    process.argv = previousArgv;
    exitSpy.mockRestore();
    logSpy.mockRestore();
    errorSpy.mockRestore();
  }
}

beforeEach(async () => {
  tempRoot = await mkdtemp(join(tmpdir(), "cullet-script-entry-"));
});

afterEach(async () => {
  vi.restoreAllMocks();
  await rm(tempRoot, { recursive: true, force: true });
});

describe.sequential("script entrypoints", () => {
  describe("happy path", () => {
    it("executes validate-kit against the current repository", async () => {
      await expect(runValidateKitAsScript()).resolves.toEqual([0]);
    });

    it("validates an individual workspace kit via --package", async () => {
      await expect(
        runValidateKitAsScript([
          "--package",
          join(repoRoot, "packages", "erp-core"),
        ]),
      ).resolves.toEqual([0]);
    });

    it("scaffolds a new kit from the repository templates", async () => {
      const kitName = `coverage-kit-${Date.now()}-${importCounter}`;
      const registryPath = join(
        repoRoot,
        "packages",
        "cli",
        "registry",
        "index.json",
      );
      const originalRegistry = await readFile(registryPath, "utf8");
      const kitDir = join(repoRoot, "packages", kitName);
      const changesetPath = join(
        repoRoot,
        ".changeset",
        `${kitName}-initial.md`,
      );
      const previousArgv = [...process.argv];
      const logs: string[] = [];
      const logSpy = vi
        .spyOn(console, "log")
        .mockImplementation((...values) => {
          logs.push(values.map((value) => String(value)).join(" "));
        });
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      process.argv = [
        "node",
        join(repoRoot, "scripts", "new-kit.mjs"),
        kitName,
        "--description",
        "Kit de cobertura gerado automaticamente.",
      ];

      try {
        await importFresh("scripts/new-kit.mjs");

        await waitUntil(() => {
          expect(logs.join("\n")).toContain(
            `npm --workspace @cullet/${kitName} run build`,
          );
        });

        await waitUntil(async () => {
          const registry = JSON.parse(
            await readFile(registryPath, "utf8"),
          ) as Record<string, { latest: string; npmName?: string }>;

          expect(registry[kitName]).toMatchObject({
            latest: "1.0.0",
            npmName: `@cullet/${kitName}`,
          });
        });

        await expect(
          readFile(join(kitDir, "README.md"), "utf8"),
        ).resolves.toContain(kitName);
        await expect(
          readFile(join(kitDir, "meta.json"), "utf8"),
        ).resolves.toContain(kitName);
        await expect(
          readFile(join(kitDir, "package.json"), "utf8"),
        ).resolves.toContain(`@cullet/${kitName}`);
        await expect(
          readFile(join(kitDir, "src", "index.ts"), "utf8"),
        ).resolves.toContain("packageMetadata.version");
        await expect(readFile(changesetPath, "utf8")).resolves.toContain(
          `"@cullet/${kitName}": patch`,
        );
      } finally {
        process.argv = previousArgv;
        logSpy.mockRestore();
        errorSpy.mockRestore();
        await writeFile(registryPath, originalRegistry, "utf8");
        await rm(kitDir, { recursive: true, force: true });
        await rm(changesetPath, { force: true });
      }
    });

    it("verifies the generated npm pack tarball contents for workspace packages", async () => {
      const packageDirs = [
        join(repoRoot, "packages", "cli"),
        join(repoRoot, "packages", "dummy-api"),
      ];

      for (const packageDir of packageDirs) {
        const buildResult = spawnSync("npm", ["run", "build"], {
          cwd: packageDir,
          encoding: "utf8",
        });

        if (buildResult.status !== 0) {
          throw new Error(
            buildResult.stderr || buildResult.stdout || "npm run build failed",
          );
        }

        const packResult = spawnSync("npm", ["pack", "--json"], {
          cwd: packageDir,
          encoding: "utf8",
        });

        if (packResult.status !== 0) {
          throw new Error(
            packResult.stderr || packResult.stdout || "npm pack failed",
          );
        }

        const tarballInfo = JSON.parse(packResult.stdout) as Array<{
          filename: string;
        }>;
        const tarballPath = join(packageDir, tarballInfo[0].filename);
        const previousArgv = [...process.argv];
        const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
        const errorSpy = vi
          .spyOn(console, "error")
          .mockImplementation(() => {});

        process.argv = [
          "node",
          join(repoRoot, "scripts", "check-pack-contents.mjs"),
          "--package",
          packageDir,
          tarballPath,
        ];

        try {
          await expect(
            importFresh("scripts/check-pack-contents.mjs"),
          ).resolves.toBeUndefined();
        } finally {
          process.argv = previousArgv;
          logSpy.mockRestore();
          errorSpy.mockRestore();
          await rm(tarballPath, { force: true });
        }
      }
    });

    it("validates all publishable workspace tarballs from the repository root", async () => {
      const buildResult = spawnSync(
        "npm",
        [
          "run",
          "build",
          "--workspace",
          "cullet",
          "--workspace",
          "@cullet/erp-core",
          "--workspace",
          "@cullet/dummy-api",
        ],
        {
          cwd: repoRoot,
          encoding: "utf8",
        },
      );

      if (buildResult.status !== 0) {
        throw new Error(
          buildResult.stderr || buildResult.stdout || "npm run build failed",
        );
      }

      const previousArgv = [...process.argv];
      const logs: string[] = [];
      const errors: string[] = [];
      const logSpy = vi
        .spyOn(console, "log")
        .mockImplementation((...values) => {
          logs.push(values.map((value) => String(value)).join(" "));
        });
      const errorSpy = vi
        .spyOn(console, "error")
        .mockImplementation((...values) => {
          errors.push(values.map((value) => String(value)).join(" "));
        });

      process.argv = [
        "node",
        join(repoRoot, "scripts", "check-pack-contents.mjs"),
      ];

      try {
        await expect(
          importFresh("scripts/check-pack-contents.mjs"),
        ).resolves.toBeUndefined();
      } finally {
        process.argv = previousArgv;
        logSpy.mockRestore();
        errorSpy.mockRestore();
      }

      expect(errors).toEqual([]);
      expect(logs.join("\n")).toContain("cullet com");
      expect(logs.join("\n")).toContain("@cullet/erp-core");
      expect(logs.join("\n")).toContain("@cullet/dummy-api");
    }, 90_000);
  });

  describe("edge cases", () => {
    it("fails validate-kit when --package does not point to a kit package", async () => {
      await expect(
        runValidateKitAsScript([
          "--package",
          join(repoRoot, "packages", "cli"),
        ]),
      ).resolves.toEqual([1]);
    });

    it("fails check-pack-contents early when the tarball path does not exist", async () => {
      await expect(
        runScriptExpectExit("scripts/check-pack-contents.mjs", [
          join(tempRoot, "missing.tgz"),
        ]),
      ).resolves.toBe(1);
    });
  });
});
