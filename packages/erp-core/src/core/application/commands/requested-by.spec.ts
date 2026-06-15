import { describe, expect, it } from "vitest";

import { InvalidValueException } from "../../exceptions/validation-exception.js";

import { RequestedBy } from "./requested-by.js";

const VALID_UUID = "550e8400-e29b-41d4-a716-446655440000";

describe("RequestedBy", () => {
    describe("fromUser", () => {
        it("builds a user identity from a valid UUID", () => {
            const requestedBy = RequestedBy.fromUser(VALID_UUID);

            expect(requestedBy.kind).toBe("user");
            expect(requestedBy.raw).toBe(VALID_UUID);
            expect(requestedBy.isUser).toBe(true);
            expect(requestedBy.isSystem).toBe(false);
            expect(requestedBy.toString()).toBe(VALID_UUID);
        });

        it("rejects a non-UUID user identity", () => {
            expect(() => RequestedBy.fromUser("not-a-uuid")).toThrow(
                InvalidValueException,
            );
        });
    });

    describe("fromSystem", () => {
        it("builds a system identity from the system:<job> format", () => {
            const requestedBy = RequestedBy.fromSystem("system:late-fee-job");

            expect(requestedBy.kind).toBe("system");
            expect(requestedBy.isSystem).toBe(true);
            expect(requestedBy.isUser).toBe(false);
        });

        it("rejects a system identity that does not match system:<job>", () => {
            expect(() => RequestedBy.fromSystem("system:Bad_Job")).toThrow(
                InvalidValueException,
            );
        });
    });

    describe("parse", () => {
        it("infers a user identity from a UUID", () => {
            const requestedBy = RequestedBy.parse(VALID_UUID);

            expect(requestedBy.kind).toBe("user");
        });

        it("infers a system identity from the system:<job> format", () => {
            const requestedBy = RequestedBy.parse("system:email-sender");

            expect(requestedBy.kind).toBe("system");
        });

        it("throws when the raw value is neither a UUID nor a system identity", () => {
            expect(() => RequestedBy.parse("anonymous")).toThrow(
                InvalidValueException,
            );
        });
    });
});
