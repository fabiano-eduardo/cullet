import { describe, expect, it } from "vitest";
import { parseKitArg } from "../../cli/utils/resolve.js";

describe("parseKitArg", () => {
  describe("happy path", () => {
    it("parses a bare kit name", () => {
      expect(parseKitArg("erp-core")).toEqual({ name: "erp-core" });
    });

    it("parses a kit name with explicit version", () => {
      expect(parseKitArg("erp-core@1.0.0")).toEqual({
        name: "erp-core",
        version: "1.0.0",
      });
    });

    it("parses scoped package names with version", () => {
      expect(parseKitArg("@scoped/name@1.0.0")).toEqual({
        name: "@scoped/name",
        version: "1.0.0",
      });
    });

    it("parses scoped package names without version", () => {
      expect(parseKitArg("@scoped/name")).toEqual({ name: "@scoped/name" });
    });

    it("trims surrounding whitespace", () => {
      expect(parseKitArg("  erp-core@1.0.0  ")).toEqual({
        name: "erp-core",
        version: "1.0.0",
      });
    });

    it("supports semver pre-release tags", () => {
      expect(parseKitArg("erp-core@1.0.0-beta.1")).toEqual({
        name: "erp-core",
        version: "1.0.0-beta.1",
      });
    });
  });

  describe("invalid formats", () => {
    it("rejects an empty string", () => {
      expect(() => parseKitArg("")).toThrow(/nome ou nome@versao/);
    });

    it("rejects a whitespace-only string", () => {
      expect(() => parseKitArg("   ")).toThrow(/nome ou nome@versao/);
    });

    it("rejects name with trailing @ but no version", () => {
      expect(() => parseKitArg("erp-core@")).toThrow(/Formato invalido/);
    });

    it("rejects empty version after trimming", () => {
      expect(() => parseKitArg("erp-core@   ")).toThrow(/Formato invalido/);
    });

    it("rejects malformed scoped names without the scope separator", () => {
      expect(() => parseKitArg("@scope@1.0.0")).toThrow(/Formato invalido/);
    });

    it("rejects multiple version separators in unscoped names", () => {
      expect(() => parseKitArg("erp-core@beta@1.0.0")).toThrow(
        /Formato invalido/,
      );
    });
  });

  describe("edge cases", () => {
    it("treats leading-@ token without separator as a bare name", () => {
      // When `@version` has no further `@`, lastIndexOf("@") === 0 which is
      // not greater than 0, so the parser treats it as a bare name. This is a
      // documented edge case — the registry lookup will then surface a clear
      // "kit not found" error to the user.
      expect(parseKitArg("@version")).toEqual({ name: "@version" });
    });

    it("parses scoped names using the @ after the package name", () => {
      expect(parseKitArg("@scope/name@1.0.0")).toEqual({
        name: "@scope/name",
        version: "1.0.0",
      });
    });
  });
});
