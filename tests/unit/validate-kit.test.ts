import { describe, expect, it } from "vitest";
import { hasModuleMockCall } from "../../scripts/validate-kit.mjs";

describe("hasModuleMockCall", () => {
    it("detects vi.mock calls in executable code", () => {
        expect(
            hasModuleMockCall(`
        import { describe, it, vi } from "vitest";

        describe("x", () => {
          vi.mock("./dependency.js");
        });
      `),
        ).toBe(true);
    });

    it("detects jest.mock calls in executable code", () => {
        expect(
            hasModuleMockCall(`
        jest.mock("./dependency.js", () => ({ value: 1 }));
      `),
        ).toBe(true);
    });

    it("ignores mentions inside comments and strings", () => {
        expect(
            hasModuleMockCall(`
        // vi.mock("./dependency.js")
        const text = 'jest.mock("./dependency.js")';
        const template = \
          \`vi.mock("./dependency.js")\`;
      `),
        ).toBe(false);
    });
});
