import { describe, expect, it } from "vitest";
import {
  getCopyDelivery,
  getCopyDependencies,
  getCopyPlacement,
  getKitKind,
  isToolingKit,
  type KitMeta,
} from "../../packages/cli/src/registry/catalog.js";

describe("getKitKind", () => {
  it("defaults to foundation when kind is absent", () => {
    expect(getKitKind({})).toBe("foundation");
    expect(getKitKind(null)).toBe("foundation");
    expect(getKitKind(undefined)).toBe("foundation");
  });

  it("returns the declared kind", () => {
    expect(getKitKind({ kind: "tooling" })).toBe("tooling");
    expect(getKitKind({ kind: "capability" })).toBe("capability");
  });
});

describe("isToolingKit", () => {
  it("is true only for tooling kits", () => {
    expect(isToolingKit({ kind: "tooling" })).toBe(true);
    expect(isToolingKit({ kind: "foundation" })).toBe(false);
    expect(isToolingKit({})).toBe(false);
  });
});

describe("getCopyDelivery", () => {
  const meta: KitMeta = {
    kind: "tooling",
    delivery: {
      copy: {
        placement: ".claude/",
        source: "files",
        dependencies: [{ name: "zod", range: ">=3" }],
        postInstall: "init.mjs",
      },
    },
  };

  it("returns a clone of the copy delivery", () => {
    const copy = getCopyDelivery(meta);
    expect(copy).toEqual({
      placement: ".claude/",
      source: "files",
      dependencies: [{ name: "zod", range: ">=3" }],
      postInstall: "init.mjs",
    });
    // mutating the result must not leak into the source meta
    copy?.dependencies.push({ name: "leak", range: "*" });
    expect(meta.delivery?.copy?.dependencies).toHaveLength(1);
  });

  it("returns undefined when there is no copy delivery", () => {
    expect(getCopyDelivery({ kind: "foundation" })).toBeUndefined();
    expect(getCopyDelivery({})).toBeUndefined();
  });
});

describe("getCopyPlacement / getCopyDependencies", () => {
  it("reads placement and dependencies from the copy delivery", () => {
    const meta: KitMeta = {
      kind: "tooling",
      delivery: {
        copy: {
          placement: "config/agents/",
          source: "files",
          dependencies: [{ name: "pino", range: "^9" }],
        },
      },
    };
    expect(getCopyPlacement(meta)).toBe("config/agents/");
    expect(getCopyDependencies(meta)).toEqual([{ name: "pino", range: "^9" }]);
  });

  it("returns sensible empties for non-tooling kits", () => {
    expect(getCopyPlacement({})).toBeUndefined();
    expect(getCopyDependencies({})).toEqual([]);
  });
});
