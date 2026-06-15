import { ValidationCode } from "../../exceptions/validation-code.js";
import { InvalidValueException } from "../../exceptions/validation-exception.js";
import { ValidationField } from "../../exceptions/validation-field.js";

// Identifies who triggered a Command.
// Two valid formats:
//   - Human user: UUID v4 (e.g.: "550e8400-e29b-41d4-a716-446655440000")
//   - System identity: "system:<job>" where <job> is [a-z][a-z0-9]*(-[a-z0-9]+)*
//     (e.g.: "system:late-fee-job", "system:email-sender")
//
// The split between `fromUser` / `fromSystem` / `parse` exists to make intent
// explicit at the call-site: whoever builds the value knows where it came from.

type RequestedByKind = "user" | "system";

const REQUESTED_BY_FIELD = ValidationField.of("requestedBy");

const UUID_PATTERN =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// system:<job> where <job> starts with a lowercase letter and may have hyphens between segments
const SYSTEM_IDENTITY_PATTERN = /^system:[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;

class RequestedBy {
    readonly kind: RequestedByKind;
    readonly raw: string;

    private constructor(kind: RequestedByKind, raw: string) {
        this.kind = kind;
        this.raw = raw;
        Object.freeze(this);
    }

    /** Builds from a human user ID (must be a UUID). */
    static fromUser(userId: string): RequestedBy {
        if (!UUID_PATTERN.test(userId)) {
            throw new InvalidValueException(
                REQUESTED_BY_FIELD,
                ValidationCode.INVALID_FORMAT,
                `requestedBy: user identity must be a UUID, got "${userId}"`,
            );
        }

        return new RequestedBy("user", userId);
    }

    /**
     * Builds from a system identity.
     * Only accepts the format "system:<job>", where <job> matches [a-z][a-z0-9]*(-[a-z0-9]+)*.
     */
    static fromSystem(systemIdentity: string): RequestedBy {
        if (!SYSTEM_IDENTITY_PATTERN.test(systemIdentity)) {
            throw new InvalidValueException(
                REQUESTED_BY_FIELD,
                ValidationCode.INVALID_FORMAT,
                `requestedBy: system identity must match "system:<job>" (e.g. "system:late-fee-job"), got "${systemIdentity}"`,
            );
        }

        return new RequestedBy("system", systemIdentity);
    }

    /**
     * Infers the kind from the raw value.
     * Use when the origin (user vs system) is not known at the call-site.
     */
    static parse(raw: string): RequestedBy {
        if (UUID_PATTERN.test(raw)) {
            return new RequestedBy("user", raw);
        }

        if (SYSTEM_IDENTITY_PATTERN.test(raw)) {
            return new RequestedBy("system", raw);
        }

        throw new InvalidValueException(
            REQUESTED_BY_FIELD,
            ValidationCode.INVALID_FORMAT,
            `requestedBy must be a UUID (user) or "system:<job>" (system), got "${raw}"`,
        );
    }

    get isUser(): boolean {
        return this.kind === "user";
    }

    get isSystem(): boolean {
        return this.kind === "system";
    }

    toString(): string {
        return this.raw;
    }
}

export type { RequestedByKind };
export { RequestedBy };
