import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  findTestOnlyKitImports,
  shouldCopyKitPath,
  syncRuntimeAssets,
} from "../../tsdown.config";

let workspace: string;

beforeEach(async () => {
  workspace = await mkdtemp(join(tmpdir(), "cullet-tsdown-config-"));
});

afterEach(async () => {
  await rm(workspace, { recursive: true, force: true });
});

describe("findTestOnlyKitImports", () => {
  it("flags production files importing spec files", async () => {
    const kitsRoot = join(workspace, "kits");
    const featureDir = join(kitsRoot, "sample", "versions", "1.0.0");

    await mkdir(featureDir, { recursive: true });
    await writeFile(
      join(featureDir, "index.ts"),
      'export * from "./entity.spec.js";\n'
    );
    await writeFile(join(featureDir, "entity.spec.ts"), "export {};\n");

    expect(findTestOnlyKitImports(kitsRoot)).toEqual([
      {
        importer: "sample/versions/1.0.0/index.ts",
        specifier: "./entity.spec.js",
      },
    ]);
  });

  it("flags nested dynamic imports of test-only files", async () => {
    const kitsRoot = join(workspace, "kits");
    const featureDir = join(kitsRoot, "sample", "versions", "1.0.0");

    await mkdir(featureDir, { recursive: true });
    await writeFile(
      join(featureDir, "index.ts"),
      [
        "export async function loadEntity() {",
        '  return import("./entity.spec.js");',
        "}",
        "",
      ].join("\n")
    );
    await writeFile(join(featureDir, "entity.spec.ts"), "export {};\n");

    expect(findTestOnlyKitImports(kitsRoot)).toEqual([
      {
        importer: "sample/versions/1.0.0/index.ts",
        specifier: "./entity.spec.js",
      },
    ]);
  });

  it("ignores imports inside files that are already excluded from publication", async () => {
    const kitsRoot = join(workspace, "kits");
    const featureDir = join(kitsRoot, "sample", "versions", "1.0.0");

    await mkdir(join(featureDir, "__tests__"), { recursive: true });
    await writeFile(
      join(featureDir, "entity.spec.ts"),
      'export * from "./__tests__/helpers.js";\n'
    );
    await writeFile(
      join(featureDir, "__tests__", "helpers.ts"),
      "export {};\n"
    );

    expect(findTestOnlyKitImports(kitsRoot)).toEqual([]);
  });

  it("ignores node_modules and dot-prefixed directories while scanning kits", async () => {
    const kitsRoot = join(workspace, "kits");
    const featureDir = join(kitsRoot, "sample", "versions", "1.0.0");
    const nodeModulesDir = join(featureDir, "node_modules", "pkg");
    const cacheDir = join(featureDir, ".cache");

    await mkdir(nodeModulesDir, { recursive: true });
    await mkdir(cacheDir, { recursive: true });
    await writeFile(
      join(nodeModulesDir, "index.ts"),
      'export * from "../../entity.spec.js";\n'
    );
    await writeFile(
      join(cacheDir, "index.ts"),
      'export * from "../entity.spec.js";\n'
    );
    await writeFile(join(featureDir, "entity.spec.ts"), "export {};\n");

    expect(findTestOnlyKitImports(kitsRoot)).toEqual([]);
  });
});

describe("shouldCopyKitPath", () => {
  it("excludes spec, test and __tests__ paths from dist/kits", () => {
    const kitsRoot = resolve(workspace, "kits");

    expect(
      shouldCopyKitPath(join(kitsRoot, "sample", "index.ts"), kitsRoot)
    ).toBe(true);
    expect(
      shouldCopyKitPath(join(kitsRoot, "sample", "index.spec.ts"), kitsRoot)
    ).toBe(false);
    expect(
      shouldCopyKitPath(join(kitsRoot, "sample", "index.test.ts"), kitsRoot)
    ).toBe(false);
    expect(
      shouldCopyKitPath(
        join(kitsRoot, "sample", "__tests__", "helpers.ts"),
        kitsRoot
      )
    ).toBe(false);
    expect(
      shouldCopyKitPath(join(kitsRoot, "sample", ".gitkeep"), kitsRoot)
    ).toBe(false);
  });
});

describe("syncRuntimeAssets", () => {
  it("copies the CommonJS compatibility stub into dist", async () => {
    const outDir = join(workspace, "dist");

    await mkdir(outDir, { recursive: true });
    await syncRuntimeAssets(outDir);

    const raw = await readFile(join(outDir, "esm-only-require.cjs"), "utf8");

    expect(raw).toContain("CommonJS");
    expect(raw).toContain("await import");
  });
});
