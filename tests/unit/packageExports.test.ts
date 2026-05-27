import { describe, expect, it } from "vitest";
import {
  buildPackageExports,
  ESM_ONLY_REQUIRE_STUB_EXPORT_PATH,
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
});
