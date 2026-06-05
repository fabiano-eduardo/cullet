import { describe, expect, it } from "vitest";
import {
  listKits,
  loadKit,
  loadRegistry,
} from "../../packages/cli/src/registry/index.js";
import erpCorePackage from "../../packages/erp-core/package.json" with { type: "json" };

// Derive the expected version from the kit's own package.json (the source of
// truth Changesets bumps) instead of hardcoding it, so a routine version bump
// does not break these tests. The catalog must stay in sync: registry latest,
// meta.json and package.json all carry the same version.
const erpCoreVersion = erpCorePackage.version;

describe("registry runtime API", () => {
  it("loads the published registry without requiring path access from the caller", async () => {
    const registry = await loadRegistry();

    expect(registry["erp-core"].latest).toBe(erpCoreVersion);
    expect(registry["erp-core"].versions).toContain(erpCoreVersion);
    expect(registry["erp-core"].versions.at(-1)).toBe(erpCoreVersion);
  });

  it("exposes npmName on each registry entry", async () => {
    const registry = await loadRegistry();

    expect(registry["erp-core"].npmName).toBe("@cullet/erp-core");
    expect(registry["dummy-api"].npmName).toBe("@cullet/dummy-api");
  });

  it("lists kits in a stable, typed shape", async () => {
    const kits = await listKits();
    const erpCore = kits.find((kit) => kit.name === "erp-core");

    expect(erpCore).toMatchObject({
      name: "erp-core",
      description:
        "Core ERP com clean architecture, temporalidade, policies e rule sets",
      latest: erpCoreVersion,
      npmName: "@cullet/erp-core",
    });
    expect(erpCore?.versions.at(-1)).toBe(erpCoreVersion);
  });

  it("loads a kit with its resolved version, meta and raw context", async () => {
    const kit = await loadKit("erp-core");

    expect(kit).toMatchObject({
      name: "erp-core",
      version: erpCoreVersion,
      latest: erpCoreVersion,
      meta: {
        name: "erp-core",
        version: erpCoreVersion,
        compatibility: {
          engines: {
            node: ">=18",
            typescript: ">=5.0.0",
          },
        },
      },
      deprecation: null,
    });
    expect(kit.versions.at(-1)).toBe(erpCoreVersion);
    expect(kit.context?.schemaVersion).toBe("1");
    expect(kit.context?.sections.map((section) => section.id)).toContain(
      "purpose",
    );
  });
});
