import { describe, expect, it } from "vitest";
import {
  buildPackageExports,
  ESM_ONLY_REQUIRE_STUB_EXPORT_PATH,
  findPackageExportConflicts,
} from "../../scripts/package-exports.mjs";

describe("buildPackageExports", () => {
  it("adds import, require and default conditions for each exported kit", () => {
    const exportsMap = buildPackageExports({
      "erp-core": {
        versions: ["1.0.0"],
        latest: "1.0.0",
        description: "ERP core",
      },
    });

    expect(exportsMap).toEqual({
      "./registry": {
        types: "./dist/registry/index.d.ts",
        import: "./dist/registry/index.js",
        require: ESM_ONLY_REQUIRE_STUB_EXPORT_PATH,
        default: "./dist/registry/index.js",
      },
      "./erp-core": {
        types: "./dist/kits/erp-core/versions/1.0.0/index.d.ts",
        import: "./dist/kits/erp-core/versions/1.0.0/index.js",
        require: ESM_ONLY_REQUIRE_STUB_EXPORT_PATH,
        default: "./dist/kits/erp-core/versions/1.0.0/index.js",
      },
      "./erp-core/1.0.0": {
        types: "./dist/kits/erp-core/versions/1.0.0/index.d.ts",
        import: "./dist/kits/erp-core/versions/1.0.0/index.js",
        require: ESM_ONLY_REQUIRE_STUB_EXPORT_PATH,
        default: "./dist/kits/erp-core/versions/1.0.0/index.js",
      },
    });
  });

  it("reports extra manual conditions that would be overwritten by sync", () => {
    const exportsMap = buildPackageExports({
      "erp-core": {
        versions: ["1.0.0"],
        latest: "1.0.0",
        description: "ERP core",
      },
    });

    const currentExports = JSON.parse(JSON.stringify(exportsMap));
    currentExports["./erp-core"].node = "./dist/custom-node.js";

    expect(findPackageExportConflicts(currentExports, exportsMap)).toEqual([
      {
        type: "extra-condition",
        subpath: "./erp-core",
        condition: "node",
      },
    ]);
  });

  it("reports extra top-level exports that are not generated from the registry", () => {
    const exportsMap = buildPackageExports({
      "erp-core": {
        versions: ["1.0.0"],
        latest: "1.0.0",
        description: "ERP core",
      },
    });

    const currentExports = {
      ...exportsMap,
      "./package.json": "./package.json",
    };

    expect(findPackageExportConflicts(currentExports, exportsMap)).toEqual([
      {
        type: "extra-export",
        subpath: "./package.json",
      },
    ]);
  });
});
