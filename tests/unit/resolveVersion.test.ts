import { describe, expect, it } from "vitest";
import {
  loadKitDeprecation,
  resolveRegistryEntry,
  resolveVersion,
  type RegistryEntry,
} from "../../cli/utils/resolve.js";

function makeEntry(overrides: Partial<RegistryEntry> = {}): RegistryEntry {
  return {
    versions: ["1.0.0", "1.1.0", "2.0.0"],
    latest: "1.1.0",
    description: "test kit",
    ...overrides,
  };
}

describe("resolveVersion", () => {
  it("returns latest when no version is requested", () => {
    const entry = makeEntry();
    expect(resolveVersion("kit", entry)).toBe("1.1.0");
  });

  it("returns latest when the requested version is undefined", () => {
    const entry = makeEntry();
    expect(resolveVersion("kit", entry, undefined)).toBe("1.1.0");
  });

  it("returns the explicit version when it exists", () => {
    const entry = makeEntry();
    expect(resolveVersion("kit", entry, "2.0.0")).toBe("2.0.0");
  });

  it("throws a descriptive error when the explicit version does not exist", () => {
    const entry = makeEntry();
    expect(() => resolveVersion("kit", entry, "9.9.9")).toThrow(
      /A versao "9\.9\.9" nao foi encontrada para "kit"/,
    );
  });

  it("lists available versions in the error message", () => {
    const entry = makeEntry();
    expect(() => resolveVersion("kit", entry, "9.9.9")).toThrow(
      /1\.0\.0, 1\.1\.0, 2\.0\.0/,
    );
  });

  it("rejects when the latest is set to a version not in the list", () => {
    // Even when no explicit version is requested, an invalid `latest` must
    // surface — silently using a phantom version would mislead the consumer.
    const entry = makeEntry({ latest: "0.0.1" });
    expect(() => resolveVersion("kit", entry)).toThrow(/A versao "0\.0\.1"/);
  });
});

describe("resolveRegistryEntry", () => {
  it("returns the entry when the kit exists", () => {
    const registry = { foo: makeEntry() };
    expect(resolveRegistryEntry(registry, "foo")).toBe(registry.foo);
  });

  it("throws when the kit does not exist", () => {
    expect(() => resolveRegistryEntry({}, "missing")).toThrow(
      /O kit "missing" nao existe no registry/,
    );
  });
});

describe("loadKitDeprecation", () => {
  // Exercised in the e2e and integration paths because deprecation lookup
  // touches the filesystem; we only assert here that the symbol is exported
  // and callable with the expected shape.
  it("is callable", () => {
    expect(typeof loadKitDeprecation).toBe("function");
  });
});
