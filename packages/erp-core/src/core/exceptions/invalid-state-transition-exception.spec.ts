import { describe, expect, it } from "vitest";

import { DomainException } from "./domain-exception.js";
import { InvalidStateTransitionException } from "./invalid-state-transition-exception.js";

describe("InvalidStateTransitionException", () => {
    describe("constructor", () => {
        it("stores from, to, and message", () => {
            const exception = new InvalidStateTransitionException(
                "ACTIVE",
                "DRAFT",
                "Cannot return to DRAFT from ACTIVE",
            );

            expect(exception.from).toBe("ACTIVE");
            expect(exception.to).toBe("DRAFT");
            expect(exception.message).toBe(
                "Cannot return to DRAFT from ACTIVE",
            );
        });

        it("accepts any string for from and to", () => {
            const exception = new InvalidStateTransitionException(
                "PENDING",
                "CANCELED",
                "invalid transition",
            );

            expect(exception.from).toBe("PENDING");
            expect(exception.to).toBe("CANCELED");
        });

        it("accepts empty strings", () => {
            const exception = new InvalidStateTransitionException(
                "",
                "",
                "msg",
            );

            expect(exception.from).toBe("");
            expect(exception.to).toBe("");
        });

        it("composes a default message from from/to when none is given", () => {
            const exception = new InvalidStateTransitionException(
                "ACTIVE",
                "DRAFT",
            );

            expect(exception.message).toBe(
                "Cannot transition from ACTIVE to DRAFT.",
            );
        });
    });

    describe("inheritance", () => {
        it("is an instance of DomainException", () => {
            const exception = new InvalidStateTransitionException(
                "A",
                "B",
                "msg",
            );

            expect(exception).toBeInstanceOf(DomainException);
        });

        it("is an instance of InvalidStateTransitionException", () => {
            const exception = new InvalidStateTransitionException(
                "A",
                "B",
                "msg",
            );

            expect(exception).toBeInstanceOf(InvalidStateTransitionException);
        });
    });
});
