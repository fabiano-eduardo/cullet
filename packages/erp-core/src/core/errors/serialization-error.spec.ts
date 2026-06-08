import { describe, expect, it } from "vitest";

import {
    DeserializationError,
    SerializationInError,
    SerializationOutError,
} from "./serialization-error";

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
