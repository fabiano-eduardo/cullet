import { describe, expect, it } from "vitest";

import { ErrorCodes } from "./error-codes.js";
import {
    evaluateTemporalWindow,
    ExpiredError,
    NotYetValidError,
} from "./temporal-error.js";

describe("evaluateTemporalWindow", () => {
    it("returns null when evaluatedAtIso is invalid", () => {
        expect(
            evaluateTemporalWindow({
                evaluatedAtIso: "invalid-date",
            }),
        ).toBeNull();
    });

    it("marks resources as not yet valid when evaluated before validFromIso", () => {
        expect(
            evaluateTemporalWindow({
                validFromIso: "2026-06-01T00:00:00.000Z",
                evaluatedAtIso: "2026-05-31T23:59:59.999Z",
            }),
        ).toEqual({ expired: false, notYetValid: true });
    });

    it("marks resources as expired when evaluated after validUntilIso", () => {
        expect(
            evaluateTemporalWindow({
                validUntilIso: "2026-06-01T00:00:00.000Z",
                evaluatedAtIso: "2026-06-01T00:00:00.001Z",
            }),
        ).toEqual({ expired: true, notYetValid: false });
    });

    it("returns a valid window state when evaluated within the configured range", () => {
        expect(
            evaluateTemporalWindow({
                validFromIso: "2026-06-01T00:00:00.000Z",
                validUntilIso: "2026-06-30T23:59:59.999Z",
                evaluatedAtIso: "2026-06-15T12:00:00.000Z",
            }),
        ).toEqual({ expired: false, notYetValid: false });
    });

    it("fails closed on a malformed upper boundary (expired, not ignored)", () => {
        expect(
            evaluateTemporalWindow({
                validUntilIso: "invalid-until",
                evaluatedAtIso: "2026-06-15T12:00:00.000Z",
            }),
        ).toEqual({ expired: true, notYetValid: false });
    });

    it("fails closed on a malformed lower boundary (not yet valid)", () => {
        expect(
            evaluateTemporalWindow({
                validFromIso: "invalid-from",
                evaluatedAtIso: "2026-06-15T12:00:00.000Z",
            }),
        ).toEqual({ expired: false, notYetValid: true });
    });
});

describe("TemporalError factories", () => {
    it("builds expired errors with the stable code, kind, and default hint", () => {
        const error = ExpiredError.detected({
            resourceType: "invite",
            resourceId: "invite-123",
            operation: "accept_invite",
            validUntilIso: "2026-06-01T00:00:00.000Z",
            evaluatedAtIso: "2026-06-01T00:00:00.001Z",
            correlationId: "corr-1",
            requestId: "req-1",
        });

        expect(error.code).toBe(ErrorCodes.temporal.expired);
        expect(error.kind).toBe("expired");
        expect(error.resourceType).toBe("invite");
        expect(error.evaluatedAtIso).toBe("2026-06-01T00:00:00.001Z");
        expect(error.correlationId).toBe("corr-1");
        expect(error.requestId).toBe("req-1");
        expect(error.metadata).toMatchObject({
            kind: "expired",
            resourceType: "invite",
            resourceId: "invite-123",
            operation: "accept_invite",
            validUntilIso: "2026-06-01T00:00:00.000Z",
            evaluatedAtIso: "2026-06-01T00:00:00.001Z",
            hint: "The window has expired. Request a new link or try again within the valid period.",
        });
    });

    it("builds not-yet-valid errors while preserving explicit hints and app options", () => {
        const cause = new Error("window not open");
        const error = NotYetValidError.detected({
            resourceType: "report",
            operation: "publish_report",
            validFromIso: "2026-06-01T00:00:00.000Z",
            evaluatedAtIso: "2026-05-31T23:59:59.999Z",
            hint: "Wait until the reporting window opens.",
            cause,
            type: "temporal",
            severity: "medium",
            publicMessage: "Tente novamente depois.",
        });

        expect(error.code).toBe(ErrorCodes.temporal.notYetValid);
        expect(error.kind).toBe("not_yet_valid");
        expect(error.cause).toBe(cause);
        expect(error.type).toBe("temporal");
        expect(error.severity).toBe("medium");
        expect(error.publicMessage).toBe("Tente novamente depois.");
        // Exhaustive: AppError envelope fields (cause/type/severity/publicMessage/
        // createdAtIso) must NOT leak into the metadata data block.
        expect(error.metadata).toEqual({
            kind: "not_yet_valid",
            resourceType: "report",
            operation: "publish_report",
            validFromIso: "2026-06-01T00:00:00.000Z",
            evaluatedAtIso: "2026-05-31T23:59:59.999Z",
            hint: "Wait until the reporting window opens.",
        });
    });
});
