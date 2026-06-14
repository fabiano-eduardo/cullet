import { describe, expect, it } from "vitest";

import { deepFreeze, makeImmutable } from "./immutable";

describe("deepFreeze", () => {
    it("freezes nested objects and arrays deeply", () => {
        const value = deepFreeze({ a: { b: [1, 2] }, c: [{ d: 1 }] });

        expect(Object.isFrozen(value)).toBe(true);
        expect(Object.isFrozen(value.a)).toBe(true);
        expect(Object.isFrozen(value.a.b)).toBe(true);
        expect(Object.isFrozen(value.c[0])).toBe(true);
    });

    it("returns primitives as-is and does not freeze Date instances", () => {
        const date = new Date("2026-01-01T00:00:00.000Z");

        expect(deepFreeze(42)).toBe(42);
        expect(deepFreeze(date)).toBe(date);
        expect(Object.isFrozen(date)).toBe(false);
    });

    it("freezes cyclic graphs without overflowing the stack", () => {
        const node: Record<string, unknown> = { name: "n" };
        node.self = node;

        const frozen = deepFreeze(node);

        expect(Object.isFrozen(frozen)).toBe(true);
        expect((frozen as { self: unknown }).self).toBe(frozen);
    });

    it("freezes a shared (acyclic) reference without re-processing it", () => {
        const shared = { v: 1 };
        const value = deepFreeze({ a: shared, b: shared });

        expect(Object.isFrozen(value.a)).toBe(true);
        expect(value.a).toBe(value.b);
    });
});

describe("makeImmutable", () => {
    it("returns primitives unchanged", () => {
        expect(makeImmutable(7)).toBe(7);
        expect(makeImmutable("x")).toBe("x");
        expect(makeImmutable(null)).toBe(null);
    });

    it("clones the input so later mutations of the source do not leak in", () => {
        const original = { nested: { count: 1 } };
        const copy = makeImmutable(original);
        original.nested.count = 99;

        expect(copy.nested.count).toBe(1);
        expect(Object.isFrozen(copy)).toBe(true);
        expect(Object.isFrozen(copy.nested)).toBe(true);
    });

    it("handles cyclic input without overflowing the stack", () => {
        const node: Record<string, unknown> = { id: 1 };
        node.self = node;

        const frozen = makeImmutable(node) as { id: number; self: unknown };

        expect(Object.isFrozen(frozen)).toBe(true);
        expect(frozen.self).toBe(frozen);
    });
});
