import { describe, expect, it } from "vitest";
import {
  DIST_DIR,
  DIST_KITS_DIR,
  KITS_DIR,
  kitDistDir,
  kitDistEntryRelative,
  kitFullControlAliasTarget,
  kitFullControlDir,
  kitImportSpecifier,
  kitNodeModulesEntry,
  kitSrcDir,
} from "../../packages/cli/src/cli/utils/paths.js";

describe("paths", () => {
  it("exposes the canonical directory names", () => {
    expect(KITS_DIR).toBe("kits");
    expect(DIST_DIR).toBe("dist");
    expect(DIST_KITS_DIR).toBe("dist/kits");
  });

  it("builds the kit source directory from the package root", () => {
    expect(kitSrcDir("/repo", "erp-core", "1.0.0")).toMatch(
      /repo[\\/]+kits[\\/]+erp-core[\\/]+versions[\\/]+1\.0\.0$/,
    );
  });

  it("resolves the kit source directory from the monorepo root when the cli lives in packages/", () => {
    expect(kitSrcDir("/repo/packages/cli", "erp-core", "1.0.0")).toMatch(
      /repo[\\/]+kits[\\/]+erp-core[\\/]+versions[\\/]+1\.0\.0$/,
    );
  });

  it("builds the kit dist directory from the package root", () => {
    expect(kitDistDir("/repo", "erp-core", "1.0.0")).toMatch(
      /repo[\\/]+dist[\\/]+kits[\\/]+erp-core[\\/]+versions[\\/]+1\.0\.0$/,
    );
  });

  it("resolves the kit dist directory from the monorepo root when the cli lives in packages/", () => {
    expect(kitDistDir("/repo/packages/cli", "erp-core", "1.0.0")).toMatch(
      /repo[\\/]+dist[\\/]+kits[\\/]+erp-core[\\/]+versions[\\/]+1\.0\.0$/,
    );
  });

  it("renders the dist entry relative path with the requested extension", () => {
    expect(kitDistEntryRelative("erp-core", "1.0.0", "js")).toBe(
      "./dist/kits/erp-core/versions/1.0.0/index.js",
    );
    expect(kitDistEntryRelative("erp-core", "1.0.0", "d.ts")).toBe(
      "./dist/kits/erp-core/versions/1.0.0/index.d.ts",
    );
  });

  it("renders the published node_modules entry", () => {
    expect(kitNodeModulesEntry("erp-core", "1.0.0")).toBe(
      "./node_modules/cullet/dist/kits/erp-core/versions/1.0.0/index.js",
    );
  });

  it("builds the full-control destination directory inside the project cwd", () => {
    expect(kitFullControlDir("/proj", "erp-core", "1.0.0")).toMatch(
      /proj[\\/]+cullet[\\/]+erp-core@1\.0\.0$/,
    );
  });

  it("renders the full-control alias target with the @version suffix", () => {
    expect(kitFullControlAliasTarget("erp-core", "1.0.0")).toBe(
      "./cullet/erp-core@1.0.0/index.ts",
    );
  });

  it("renders the import specifier without version when latest is implicit", () => {
    expect(kitImportSpecifier("erp-core", "1.0.0", true)).toBe(
      "cullet/erp-core",
    );
  });

  it("renders the import specifier with version when latest is not implicit", () => {
    expect(kitImportSpecifier("erp-core", "1.0.0", false)).toBe(
      "cullet/erp-core/1.0.0",
    );
  });
});
