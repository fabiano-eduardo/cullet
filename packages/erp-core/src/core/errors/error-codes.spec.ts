import { describe, expect, it } from "vitest";

import { AlreadyExistsError } from "./conflict-error";
import { ErrorCodes, serializationErrorCode } from "./error-codes";
import { IdempotencyError } from "./idempotency-error";
import { SerializationCodes } from "./serialization-error";

describe("ErrorCodes", () => {
    it("keeps the audited conflict and idempotency codes as the single source of truth", () => {
        expect(ErrorCodes.conflict.alreadyExists).toBe("conf.already_exists");
        expect(ErrorCodes.idempotency.replayNotSupported).toBe(
            "idemp.replay_not_supported",
        );
    });

    it("drives public error factories instead of duplicating string literals", () => {
        const alreadyExists = AlreadyExistsError.detected({
            entity: "invoice",
        });
        const replayNotSupported = IdempotencyError.replayNotSupported({
            operation: "createInvoice",
            key: "idem-1234567890",
        });

        expect(alreadyExists.code).toBe(ErrorCodes.conflict.alreadyExists);
        expect(replayNotSupported.code).toBe(
            ErrorCodes.idempotency.replayNotSupported,
        );
    });

    it("builds serialization codes from the same shared helper", () => {
        expect(SerializationCodes.code("deserialize", "invalid_json")).toBe(
            serializationErrorCode("deserialize", "invalid_json"),
        );
        expect(SerializationCodes.code("serialize", "stringify_failed")).toBe(
            serializationErrorCode("serialize", "stringify_failed"),
        );
    });
});
