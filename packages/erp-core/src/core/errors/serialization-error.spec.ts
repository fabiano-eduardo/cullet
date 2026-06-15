import { describe, expect, it } from "vitest";

import {
    DeserializationError,
    safePreview,
    SerializationInError,
    SerializationOutError,
} from "./serialization-error.js";

describe("serialization-error aliases", () => {
    it("keeps DeserializationError as an alias of SerializationInError", () => {
        expect(DeserializationError).toBe(SerializationInError);

        const error = DeserializationError.failure("invalid_shape", {
            boundary: "dto_to_domain",
            contract: "UserDto",
        });

        expect(error).toBeInstanceOf(SerializationInError);
        expect(error.direction).toBe("deserialize");
        expect(error.category).toBe("invalid_shape");
    });

    it("keeps SerializationOutError as the outgoing counterpart", () => {
        const error = SerializationOutError.failure("stringify_failed", {
            boundary: "event_out",
            contract: "UserEvent",
        });

        expect(error.direction).toBe("serialize");
        expect(error.category).toBe("stringify_failed");
    });
});

describe("SerializationMessages (via failure factories)", () => {
    const inMessage = (
        category: Parameters<typeof SerializationInError.failure>[0],
    ) =>
        SerializationInError.failure(category, {
            boundary: "http_in",
            contract: "Dto",
        }).message;

    const outMessage = (
        category: Parameters<typeof SerializationOutError.failure>[0],
    ) =>
        SerializationOutError.failure(category, {
            boundary: "http_out",
            contract: "Dto",
        }).message;

    it("maps each incoming category to its dedicated message", () => {
        expect(inMessage("invalid_json")).toBe(
            "Invalid payload: malformed JSON",
        );
        expect(inMessage("schema_version_missing")).toBe(
            "Invalid payload: schemaVersion is missing",
        );
        expect(inMessage("schema_version_unsupported")).toBe(
            "Invalid payload: schemaVersion is not supported",
        );
        expect(inMessage("invalid_shape")).toBe(
            "Invalid payload: incompatible shape",
        );
        expect(inMessage("mapping_not_implemented")).toBe(
            "Unsupported payload: mapping not implemented",
        );
        expect(inMessage("contract_mismatch")).toBe(
            "Payload does not match the expected contract",
        );
        expect(inMessage("unknown")).toBe("Failed to parse incoming payload");
    });

    it("maps each outgoing category to its dedicated message", () => {
        expect(outMessage("stringify_failed")).toBe(
            "Failed to serialize the response",
        );
        expect(outMessage("contract_mismatch")).toBe(
            "Response does not match the expected contract",
        );
        expect(outMessage("unknown")).toBe("Failed to build the response");
    });
});

describe("safePreview", () => {
    it("returns short strings unchanged", () => {
        expect(safePreview("hello")).toBe("hello");
    });

    it("serializes non-string values as JSON", () => {
        expect(safePreview({ a: 1 })).toBe('{"a":1}');
    });

    it("truncates values that exceed the limit with an ellipsis", () => {
        const preview = safePreview("x".repeat(300));

        expect(preview).toHaveLength(241);
        expect(preview?.endsWith("…")).toBe(true);
    });

    it("returns undefined when the value cannot be serialized", () => {
        const circular: Record<string, unknown> = {};
        circular.self = circular;

        expect(safePreview(circular)).toBeUndefined();
    });
});
