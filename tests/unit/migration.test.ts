import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  loadKitMigrationPlan,
  runKitMigrationCodemod,
} from "../../cli/utils/migration.js";

let root: string;
let projectDir: string;
let metaUrl: string;

async function writeJson(path: string, data: unknown): Promise<void> {
  await mkdir(join(path, ".."), { recursive: true });
  await writeFile(path, JSON.stringify(data, null, 2));
}

async function setupFakeCullet(
  opts: {
    meta?: Record<string, unknown>;
    codemodSource?: string | null;
    guide?: string | null;
  } = {},
): Promise<void> {
  await writeJson(join(root, "package.json"), {
    name: "cullet",
    version: "0.0.0",
  });
  await writeJson(join(root, "registry", "index.json"), {
    "erp-core": {
      versions: ["1.0.0", "2.0.0"],
      latest: "2.0.0",
      description: "ERP core",
    },
  });

  const versionRoot = join(root, "kits", "erp-core", "versions", "1.0.0");

  await writeJson(
    join(versionRoot, "meta.json"),
    opts.meta ?? {
      deprecated: {
        since: "2.0.0",
        reason: "API de policies reescrita.",
        successor: {
          name: "erp-core",
          version: "2.0.0",
          guide: "MIGRATION.md",
          notes: "Atualize os aliases antes de trocar os imports.",
          codemod: {
            path: "codemods/1.0.0-to-2.0.0.mjs",
            description: "Renomeia simbolos legados da API",
          },
        },
      },
    },
  );
  await writeFile(join(versionRoot, "index.ts"), "export {};\n", "utf8");

  if (opts.guide !== null) {
    await writeFile(
      join(versionRoot, "MIGRATION.md"),
      opts.guide ?? "# Migration\n",
      "utf8",
    );
  }

  if (opts.codemodSource !== null) {
    await mkdir(join(versionRoot, "codemods"), { recursive: true });
    await writeFile(
      join(versionRoot, "codemods", "1.0.0-to-2.0.0.mjs"),
      opts.codemodSource ??
        [
          'import { mkdir, writeFile } from "node:fs/promises";',
          'import { join } from "node:path";',
          "",
          "export async function run(context) {",
          "  context.report(`executando ${context.source.version} -> ${context.target.version}`);",
          "  if (!context.dryRun) {",
          "    await mkdir(context.projectDir, { recursive: true });",
          '    await writeFile(join(context.projectDir, "migration-applied.txt"), "ok\\n", "utf8");',
          "  }",
          "  return {",
          '    summary: context.dryRun ? "dry-run" : "applied",',
          '    changedFiles: [join(context.projectDir, "migration-applied.txt")],',
          "  };",
          "}",
          "",
        ].join("\n"),
      "utf8",
    );
  }

  metaUrl = pathToFileURL(join(root, "cli", "index.js")).href;
  await mkdir(join(root, "cli"), { recursive: true });
  await writeFile(join(root, "cli", "index.js"), "", "utf8");
}

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "cullet-migration-"));
  projectDir = join(root, "consumer");
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe("loadKitMigrationPlan", () => {
  it("resolves guide and codemod assets for a deprecated version", async () => {
    await setupFakeCullet();

    const plan = await loadKitMigrationPlan(metaUrl, "erp-core", "1.0.0");

    expect(plan).not.toBeNull();
    expect(plan).toMatchObject({
      source: { name: "erp-core", version: "1.0.0" },
      target: { name: "erp-core", version: "2.0.0" },
      guide: { declaredPath: "MIGRATION.md" },
      codemod: {
        declaredPath: "codemods/1.0.0-to-2.0.0.mjs",
        description: "Renomeia simbolos legados da API",
      },
    });
    expect(plan?.guide?.resolvedPath).toContain("MIGRATION.md");
    expect(plan?.codemod?.resolvedPath).toContain("1.0.0-to-2.0.0.mjs");
  });

  it("returns null when the source version is not deprecated", async () => {
    await setupFakeCullet({ meta: { deprecated: false } });
    await expect(
      loadKitMigrationPlan(metaUrl, "erp-core", "1.0.0"),
    ).resolves.toBeNull();
  });
});

describe("runKitMigrationCodemod", () => {
  it("runs the declared codemod in dry-run mode without writing files", async () => {
    await setupFakeCullet();
    const plan = await loadKitMigrationPlan(metaUrl, "erp-core", "1.0.0");

    if (plan === null) {
      throw new Error("expected migration plan");
    }

    const reports: string[] = [];
    const result = await runKitMigrationCodemod(plan, {
      projectDir,
      dryRun: true,
      report(message) {
        reports.push(message);
      },
    });

    await expect(
      readFile(join(projectDir, "migration-applied.txt"), "utf8"),
    ).rejects.toThrow();
    expect(reports).toEqual(["executando 1.0.0 -> 2.0.0"]);
    expect(result).toEqual({
      summary: "dry-run",
      changedFiles: [join(projectDir, "migration-applied.txt")],
    });
  });

  it("applies the codemod when dry-run is disabled", async () => {
    await setupFakeCullet();
    const plan = await loadKitMigrationPlan(metaUrl, "erp-core", "1.0.0");

    if (plan === null) {
      throw new Error("expected migration plan");
    }

    const result = await runKitMigrationCodemod(plan, {
      projectDir,
      dryRun: false,
      report() {},
    });

    await expect(
      readFile(join(projectDir, "migration-applied.txt"), "utf8"),
    ).resolves.toBe("ok\n");
    expect(result).toEqual({
      summary: "applied",
      changedFiles: [join(projectDir, "migration-applied.txt")],
    });
  });
});
