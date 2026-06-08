import { AppError } from "./app-error";
import { ErrorCodes } from "./error-codes";
import type { AppErrorOptions, ErrorSeverity } from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type AuthenticationErrorReason =
    | "missing_token"
    | "malformed_token"
    | "invalid_token"
    | "expired_token"
    | "revoked_token"
    | "invalid_credentials"
    | "session_not_found"
    | "session_expired"
    | "unknown";

type AuthenticationErrorMetadata = {
    reason: AuthenticationErrorReason;
    authScheme?: "bearer" | "cookie" | "basic" | "unknown";
    tokenLocation?: "header" | "cookie" | "query" | "unknown";
    expiresAtIso?: string;
    correlationId?: string;
    requestId?: string;
    details?: string;
};

type AuthenticationErrorFactoryOptions = Omit<
    AuthenticationErrorMetadata,
    "reason"
> &
    Omit<AppErrorOptions, "metadata">;

// ─────────────────────────────────────────────────────────────────────────────
// AuthenticationError
// ─────────────────────────────────────────────────────────────────────────────

class AuthenticationError extends AppError {
    public readonly reason: AuthenticationErrorReason;

    private constructor(params: {
        message: string;
        code: string;
        reason: AuthenticationErrorReason;
        metadata?: Omit<AuthenticationErrorMetadata, "reason">;
        cause?: unknown;
        type?: string;
        severity?: ErrorSeverity;
        correlationId?: string;
        requestId?: string;
        commandId?: string;
        createdAtIso?: string;
        publicMessage?: string;
    }) {
        super(params.message, params.code, {
            cause: params.cause,
            metadata: {
                reason: params.reason,
                ...(params.metadata ?? {}),
            },
            type: params.type,
            severity: params.severity,
            correlationId: params.correlationId,
            requestId: params.requestId,
            commandId: params.commandId,
            createdAtIso: params.createdAtIso,
            publicMessage: params.publicMessage,
        });

        this.reason = params.reason;
        Object.freeze(this);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Factory methods
    // ─────────────────────────────────────────────────────────────────────────

    static missingToken(
        options?: AuthenticationErrorFactoryOptions,
    ): AuthenticationError {
        return new AuthenticationError({
            message: "Missing credentials",
            code: ErrorCodes.authentication.missingToken,
            reason: "missing_token",
            metadata: compactMetadata(options),
            ...extractAppErrorOptions(options),
        });
    }

    static invalidToken(
        options?: AuthenticationErrorFactoryOptions & { cause?: unknown },
    ): AuthenticationError {
        return new AuthenticationError({
            message: "Invalid credentials",
            code: ErrorCodes.authentication.invalidToken,
            reason: "invalid_token",
            metadata: compactMetadata({
                authScheme: options?.authScheme,
                tokenLocation: options?.tokenLocation,
                details: options?.details,
                correlationId: options?.correlationId,
                requestId: options?.requestId,
            }),
            ...extractAppErrorOptions(options),
        });
    }

    static expiredToken(
        options?: AuthenticationErrorFactoryOptions & { sessionId?: string },
    ): AuthenticationError {
        return new AuthenticationError({
            message: "Expired credentials",
            code: ErrorCodes.authentication.expiredToken,
            reason: "expired_token",
            metadata: compactMetadata(options),
            ...extractAppErrorOptions(options),
        });
    }

    static invalidCredentials(
        options?: Pick<
            AuthenticationErrorFactoryOptions,
            | "correlationId"
            | "requestId"
            | "type"
            | "severity"
            | "createdAtIso"
            | "publicMessage"
        >,
    ): AuthenticationError {
        return new AuthenticationError({
            message: "Invalid username or password",
            code: ErrorCodes.authentication.invalidCredentials,
            reason: "invalid_credentials",
            metadata: compactMetadata(options),
            ...extractAppErrorOptions(options),
        });
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function extractAppErrorOptions(options?: Partial<AppErrorOptions>) {
    return {
        cause: options?.cause,
        type: options?.type,
        severity: options?.severity,
        correlationId: options?.correlationId,
        requestId: options?.requestId,
        commandId: options?.commandId,
        createdAtIso: options?.createdAtIso,
        publicMessage: options?.publicMessage,
    };
}

function compactMetadata<T extends Record<string, unknown>>(
    input?: T,
): T | undefined {
    if (!input) return undefined;

    return Object.fromEntries(
        Object.entries(input).filter(([, value]) => value !== undefined),
    ) as T;
}

export { AuthenticationError };
export type { AuthenticationErrorMetadata, AuthenticationErrorReason };
