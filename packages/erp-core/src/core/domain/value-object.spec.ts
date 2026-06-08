import { describe, expect, it } from "vitest";

import { ValueObject } from "./value-object";

class StringVO extends ValueObject<string, string> {
    constructor(value: string) {
        super(value);
        this.finalize();
    }

    equals(other: this): boolean {
        return this.value === other.value;
    }

    toPrimitive(): string {
        return this.value as string;
    }
}

interface NestedData {
    name: string;
    address: { street: string; number: number };
}

class ObjectVO extends ValueObject<NestedData, NestedData> {
    constructor(value: NestedData) {
        super(value);
        this.finalize();
    }

    equals(other: this): boolean {
        return JSON.stringify(this.value) === JSON.stringify(other.value);
    }

    toPrimitive(): NestedData {
        return this.value as NestedData;
    }
}

class ArrayVO extends ValueObject<number[], number[]> {
    constructor(value: number[]) {
        super(value);
        this.finalize();
    }

    equals(other: this): boolean {
        return JSON.stringify(this.value) === JSON.stringify(other.value);
    }

    toPrimitive(): number[] {
        return this.value as number[];
    }
}

class DateContainerVO extends ValueObject<{ date: Date }, { date: Date }> {
    constructor(value: { date: Date }) {
        super(value);
        this.finalize();
    }

    equals(other: this): boolean {
        return (
            (this.value.date as Date).getTime() ===
            (other.value.date as Date).getTime()
        );
    }

    toPrimitive() {
        return this.value as { date: Date };
    }
}

describe("ValueObject", () => {
    describe("value immutability", () => {
        it("stores the primitive value correctly", () => {
            const vo = new StringVO("hello");

            expect(vo.value).toBe("hello");
        });

        it("deeply freezes nested objects", () => {
            const vo = new ObjectVO({
                name: "John",
                address: { street: "Main St", number: 10 },
            });

            expect(Object.isFrozen(vo.value)).toBe(true);
            expect(Object.isFrozen((vo.value as NestedData).address)).toBe(
                true,
            );
        });

        it("freezes arrays", () => {
            const vo = new ArrayVO([1, 2, 3]);

            expect(Object.isFrozen(vo.value)).toBe(true);
        });

        it("does not freeze Date instances inside the object", () => {
            const date = new Date("2024-01-01");
            const vo = new DateContainerVO({ date });

            expect(Object.isFrozen((vo.value as { date: Date }).date)).toBe(
                false,
            );
        });

        it("is not affected by mutation of the original object after construction", () => {
            const original: NestedData = {
                name: "Original",
                address: { street: "Main St", number: 1 },
            };
            const vo = new ObjectVO(original);
            original.name = "Modified";
            original.address.number = 999;

            expect((vo.value as NestedData).name).toBe("Original");
            expect((vo.value as NestedData).address.number).toBe(1);
        });
    });

    describe("finalize()", () => {
        it("freezes the value object instance after finalize()", () => {
            const vo = new StringVO("frozen");

            expect(Object.isFrozen(vo)).toBe(true);
        });
    });

    describe("toJSON()", () => {
        it("returns the result of toPrimitive()", () => {
            const vo = new StringVO("test");

            expect(vo.toJSON()).toBe("test");
        });

        it("returns the correct structure for objects", () => {
            const data: NestedData = {
                name: "Ann",
                address: { street: "Second St", number: 5 },
            };
            const vo = new ObjectVO(data);

            expect(vo.toJSON()).toEqual(data);
        });
    });

    describe("contractVersion", () => {
        it("exposes the CONTRACT_VERSION from the @version decorator", () => {
            const vo = new StringVO("x");

            expect(vo.contractVersion).toBe("1.0");
        });
    });

    describe("equals()", () => {
        it("returns true for value objects with the same primitive value", () => {
            const a = new StringVO("abc");
            const b = new StringVO("abc");

            expect(a.equals(b)).toBe(true);
        });

        it("returns false for value objects with different values", () => {
            const a = new StringVO("abc");
            const b = new StringVO("xyz");

            expect(a.equals(b)).toBe(false);
        });

        it("returns true for objects with the same structure", () => {
            const a = new ObjectVO({
                name: "X",
                address: { street: "Main St", number: 1 },
            });
            const b = new ObjectVO({
                name: "X",
                address: { street: "Main St", number: 1 },
            });

            expect(a.equals(b)).toBe(true);
        });

        it("returns false for objects with different structures", () => {
            const a = new ObjectVO({
                name: "X",
                address: { street: "Main St", number: 1 },
            });
            const b = new ObjectVO({
                name: "X",
                address: { street: "Second St", number: 1 },
            });

            expect(a.equals(b)).toBe(false);
        });
    });
});
