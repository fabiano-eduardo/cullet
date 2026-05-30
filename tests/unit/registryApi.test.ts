import { describe, expect, it } from "vitest";
import { listKits, loadKit, loadRegistry } from "../../packages/cli/src/registry/index.js";

describe("registry runtime API", () => {
  it("loads the published registry without requiring path access from the caller", async () => {
    const registry = await loadRegistry();

    expect(registry["erp-core"]).toMatchObject({
      latest: "1.0.0",
      versions: ["1.0.0"],
    });
  });

  it("exposes npmName on each registry entry", async () => {
    const registry = await loadRegistry();

    expect(registry["erp-core"].npmName).toBe("@cullet/erp-core");
    expect(registry["dummy-api"].npmName).toBe("@cullet/dummy-api");
  });

  it("lists kits in a stable, typed shape", async () => {
    await expect(listKits()).resolves.toContainEqual({
      name: "erp-core",
      description:
        "Core ERP com clean architecture, temporalidade, policies e rule sets",
      latest: "1.0.0",
      versions: ["1.0.0"],
      npmName: "@cullet/erp-core",
    });
  });

  it("loads a kit with its resolved version, meta and raw context", async () => {
    const kit = await loadKit("erp-core");

    expect(kit).toMatchObject({
      name: "erp-core",
      version: "1.0.0",
      latest: "1.0.0",
      versions: ["1.0.0"],
      meta: {
        name: "erp-core",
        version: "1.0.0",
        compatibility: {
          engines: {
            node: ">=18",
            typescript: ">=5.0.0",
          },
        },
      },
      deprecation: null,
    });
    expect(kit.context?.schemaVersion).toBe("1");
    expect(kit.context?.sections.map((section) => section.id)).toContain(
      "purpose",
    );
  });
});
