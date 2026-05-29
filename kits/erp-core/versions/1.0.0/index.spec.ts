import { describe, expect, it } from "vitest";

import packageMetadata from "./package.json" with { type: "json" };

import { ERP_CORE_NAME, ERP_CORE_VERSION, erpCoreRelease } from "./index";

describe("erp-core entrypoint metadata", () => {
  it("derives ERP_CORE_VERSION from package.json", () => {
    expect(ERP_CORE_VERSION).toBe(packageMetadata.version);
  });

  it("exposes a release descriptor consistent with the package metadata", () => {
    expect(erpCoreRelease).toEqual({
      name: ERP_CORE_NAME,
      version: packageMetadata.version,
    });
  });
});
