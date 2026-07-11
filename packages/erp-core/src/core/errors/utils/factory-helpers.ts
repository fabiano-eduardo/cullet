// Shared helpers for the error factories: separating the AppError envelope
// options from the free-form metadata, and dropping undefined-valued keys.
// Previously each of authentication/authorization/integration carried its own
// near-identical copy of these.

import type { AppErrorOptions } from "../types.js";

/** The envelope fields AppError understands; everything else is metadata. */
const APP_ERROR_OPTION_KEYS = [
    "cause",
    "type",
    "severity",
    "correlationId",
    "requestId",
    "commandId",
    "createdAtIso",
    "publicMessage",
] as const;

type AppErrorEnvelope = Pick<
    AppErrorOptions,
    (typeof APP_ERROR_OPTION_KEYS)[number]
>;

/**
 * Picks the AppError envelope fields out of a flat factory input, so they can
 * be forwarded to the constructor as options instead of leaking into metadata.
 */
function pickAppErrorOptions(
    input?: Partial<AppErrorOptions>,
): AppErrorEnvelope {
    return {
        cause: input?.cause,
        type: input?.type,
        severity: input?.severity,
        correlationId: input?.correlationId,
        requestId: input?.requestId,
        commandId: input?.commandId,
        createdAtIso: input?.createdAtIso,
        publicMessage: input?.publicMessage,
    };
}

/**
 * The complement of {@link pickAppErrorOptions}: everything that is *not* an
 * AppError envelope field, i.e. the caller-supplied metadata. Keeps the cause
 * and the public message out of the internal data block.
 */
function stripAppErrorOptions<T extends Record<string, unknown>>(
    input: T,
): Omit<T, (typeof APP_ERROR_OPTION_KEYS)[number]> {
    const result = { ...input };
    for (const key of APP_ERROR_OPTION_KEYS) {
        delete result[key];
    }
    return result;
}

/** Drops keys whose value is `undefined` (mirrors how JSON.stringify treats them). */
function compactMetadata<T extends Record<string, unknown>>(
    input?: T,
): T | undefined {
    if (!input) return undefined;

    return Object.fromEntries(
        Object.entries(input).filter(([, value]) => value !== undefined),
    ) as T;
}

export { compactMetadata, pickAppErrorOptions, stripAppErrorOptions };
