import { describe, expect, it } from "vitest";

import { DomainException } from "./domain-exception.js";

class ConcreteDomainException extends DomainException {
    constructor(message: string, options?: { cause?: unknown }) {
        super(message, options);
    }
}

describe("DomainException", () => {
    describe("constructor", () => {
        it("stores the provided message", () => {
            const exception = new ConcreteDomainException(
                "something went wrong",
            );

            expect(exception.message).toBe("something went wrong");
        });

        it("accepts an empty message", () => {
            const exception = new ConcreteDomainException("");

            expect(exception.message).toBe("");
        });

        it("accepts messages with special characters", () => {
            const message = 'Error: field "name" invalid (code: 42)';
            const exception = new ConcreteDomainException(message);

            expect(exception.message).toBe(message);
        });

        it("propagates the wrapped cause when provided", () => {
            const cause = new Error("boom");
            const exception = new ConcreteDomainException("wrapped", { cause });

            expect(exception.cause).toBe(cause);
        });

        it("leaves cause undefined when no options are given", () => {
            const exception = new ConcreteDomainException("no cause");

            expect(exception.cause).toBeUndefined();
        });
    });

    describe("inheritance", () => {
        it("is an instance of DomainException", () => {
            const exception = new ConcreteDomainException("msg");

            expect(exception).toBeInstanceOf(DomainException);
        });

        it("keeps the subclass prototype chain intact", () => {
            const exception = new ConcreteDomainException("msg");

            expect(Object.getPrototypeOf(exception)).toBe(
                ConcreteDomainException.prototype,
            );
        });
    });
});
