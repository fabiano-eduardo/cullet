import { describe, expect, it } from "vitest";
import { resolveSkills } from "./skills.js";

describe("resolveSkills", () => {
    it("returns an empty list when there are no skill names", () => {
        expect(resolveSkills(undefined, { a: "x" })).toEqual([]);
        expect(resolveSkills([], { a: "x" })).toEqual([]);
    });

    it("expands a string value into a Skill named by its key", () => {
        expect(
            resolveSkills(["tdd"], { tdd: "Write a failing test first." }),
        ).toEqual([
            { name: "tdd", instructions: "Write a failing test first." },
        ]);
    });

    it("uses a Skill value as-is, defaulting name to the registry key", () => {
        expect(
            resolveSkills(["a", "b"], {
                a: { name: "Alpha", instructions: "alpha" },
                b: { name: "", instructions: "beta", description: "d" },
            }),
        ).toEqual([
            { name: "Alpha", instructions: "alpha" },
            { name: "b", instructions: "beta", description: "d" },
        ]);
    });

    it("preserves the order of the requested names", () => {
        const resolved = resolveSkills(["b", "a"], { a: "A", b: "B" });
        expect(resolved.map((s) => s.name)).toEqual(["b", "a"]);
    });

    it("throws when a name is missing from the registry", () => {
        expect(() => resolveSkills(["nope"], { tdd: "x" })).toThrow(
            /unknown skill "nope".*Available: tdd/s,
        );
    });

    it("reports '(none)' available when the registry is empty", () => {
        expect(() => resolveSkills(["x"], {})).toThrow(
            /unknown skill "x".*Available: \(none\)/s,
        );
    });

    it("throws when names are requested but no registry is provided", () => {
        expect(() => resolveSkills(["tdd"], undefined)).toThrow(
            /no skills registry/,
        );
    });
});
