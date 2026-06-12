import { describe, expect, it } from "vitest";
import { findBareAnyUsages } from "../../scripts/kit-ast.mjs";
import { parseTsSource } from "../../scripts/source-analysis.mjs";

function detect(src: string): Array<{ line: number; snippet: string }> {
    return findBareAnyUsages(parseTsSource("inline.ts", src));
}

describe("findBareAnyUsages", () => {
    // The previous regex missed `any` in idiomatic type positions (colon
    // hugging the identifier, generic arguments, return types). These are the
    // forms it must now catch.
    it.each([
        ["type annotation", "const x: any = 1;"],
        ["function parameter", "function f(p: any) {}"],
        ["interface member", "interface I { a: any }"],
        ["generic argument", "type R = Record<string, any>;"],
        ["promise generic", "function load(): Promise<any> { return null; }"],
        ["return type", "function g(): any { return 1; }"],
        ["array type", "const arr: any[] = [];"],
        ["as cast", "const c = value as any;"],
        ["prefix cast", "const d = <any>value;"],
    ])("detects bare any in %s", (_label, src) => {
        expect(detect(src)).toHaveLength(1);
    });

    // The identifier or English word "any" is not the `any` type. These mirror
    // the real occurrences in the catalog's kits, which must never be flagged.
    it.each([
        ["line comment", "// accepts any object compatible with the port\n"],
        ["block comment", "/* overlap at any point */\n"],
        ["string literal", 'const label = "compute:any";'],
        ["test title", 'it("accepts any ValidationCode", () => {});'],
        ["property key named any", "const o = { any: 1 };"],
        ["identifier named any", "const any = 5;"],
    ])("does not flag the word any in %s", (_label, src) => {
        expect(detect(src)).toEqual([]);
    });

    it("skips a usage justified with a trailing // any-ok: comment", () => {
        expect(detect("const x: any = 1; // any-ok: legacy bridge")).toEqual(
            [],
        );
    });

    it("reports at most one finding per offending line", () => {
        expect(detect("const x: any = value as any;")).toHaveLength(1);
    });

    it("reports the 1-based line number and trimmed snippet", () => {
        const [hit] = detect("const a = 1;\n  const b: any = 2;\n");
        expect(hit).toEqual({ line: 2, snippet: "const b: any = 2;" });
    });
});
