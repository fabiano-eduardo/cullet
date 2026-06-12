/**
 * Superficie publica da telemetria do CLI do cullet. Orquestra a configuracao
 * opt-in (habilitar/desabilitar/status), o registro local e o envio remoto
 * best-effort dos eventos de comando. A implementacao esta fragmentada em
 * ./telemetry/* (tipos, caminhos, endpoint, diagnostico, store e transporte).
 */
import { randomUUID } from "node:crypto";
import {
    logRemoteTelemetryFailure,
    logTelemetryFailure,
} from "./telemetry/diagnostics.js";
import { normalizeTelemetryEndpoint } from "./telemetry/endpoint.js";
import { isIgnorableTelemetryError } from "./telemetry/errors.js";
import {
    appendLocalEvent,
    loadCliVersion,
    readTelemetryConfigFile,
    toStatus,
    writeTelemetryConfigFile,
} from "./telemetry/store.js";
import { postRemoteEvent } from "./telemetry/transport.js";
import type {
    TelemetryCommandTracker,
    TelemetryConfig,
    TelemetryEnvelope,
    TelemetryEventInput,
    TelemetryProperty,
    TelemetryStatus,
} from "./telemetry/types.js";

export {
    resolveTelemetryConfigPath,
    resolveTelemetryLogPath,
} from "./telemetry/paths.js";
export type {
    TelemetryCommandTracker,
    TelemetryConfig,
    TelemetryEventInput,
    TelemetryProperty,
    TelemetryStatus,
} from "./telemetry/types.js";

class CommandTracker implements TelemetryCommandTracker {
    private readonly properties: Record<string, TelemetryProperty> = {};

    set(name: string, value: TelemetryProperty | undefined): void {
        if (value === undefined) {
            delete this.properties[name];
            return;
        }

        this.properties[name] = value;
    }

    snapshot(): Record<string, TelemetryProperty> {
        return { ...this.properties };
    }
}

export async function getTelemetryStatus(
    options: { env?: NodeJS.ProcessEnv } = {},
): Promise<TelemetryStatus> {
    const env = options.env ?? process.env;
    const config = await readTelemetryConfigFile(env);
    return toStatus(env, config);
}

export async function enableTelemetry(
    options: { endpoint?: string; env?: NodeJS.ProcessEnv } = {},
): Promise<TelemetryStatus> {
    const env = options.env ?? process.env;
    const current = await readTelemetryConfigFile(env);
    const endpoint =
        options.endpoint === undefined
            ? current.endpoint
            : normalizeTelemetryEndpoint(options.endpoint);
    const next: TelemetryConfig = {
        enabled: true,
        anonymousId: current.anonymousId ?? randomUUID(),
        endpoint,
    };

    await writeTelemetryConfigFile(env, next);
    return toStatus(env, next);
}

export async function disableTelemetry(
    options: { env?: NodeJS.ProcessEnv } = {},
): Promise<TelemetryStatus> {
    const env = options.env ?? process.env;
    const current = await readTelemetryConfigFile(env);
    const next: TelemetryConfig = {
        enabled: false,
        anonymousId: current.anonymousId,
        endpoint: current.endpoint,
    };

    await writeTelemetryConfigFile(env, next);
    return toStatus(env, next);
}

export async function emitTelemetryIfEnabled(
    fromMetaUrl: string,
    event: TelemetryEventInput,
    options: { env?: NodeJS.ProcessEnv } = {},
): Promise<boolean> {
    const env = options.env ?? process.env;

    try {
        const config = await readTelemetryConfigFile(env);
        if (!config.enabled) {
            return false;
        }

        const anonymousId = config.anonymousId ?? randomUUID();
        if (config.anonymousId !== anonymousId) {
            await writeTelemetryConfigFile(env, {
                ...config,
                anonymousId,
            });
        }

        const payload: TelemetryEnvelope = {
            event: "cli.command",
            timestamp: new Date().toISOString(),
            anonymousId,
            cliVersion: await loadCliVersion(fromMetaUrl),
            command: event.command,
            success: event.success,
            durationMs: event.durationMs,
            system: {
                platform: process.platform,
                nodeVersion: process.version,
                arch: process.arch,
            },
            properties: event.properties ?? {},
        };

        await appendLocalEvent(env, payload);

        if (typeof config.endpoint === "string" && config.endpoint.length > 0) {
            try {
                await postRemoteEvent(config.endpoint, payload);
            } catch (error) {
                logRemoteTelemetryFailure(config.endpoint, error, env);
            }
        }

        return true;
    } catch (error) {
        if (!isIgnorableTelemetryError(error)) {
            throw error;
        }

        return false;
    }
}

export async function runCommandWithTelemetry<T>(options: {
    fromMetaUrl: string;
    command: string;
    env?: NodeJS.ProcessEnv;
    handler(tracker: TelemetryCommandTracker): Promise<T>;
}): Promise<T> {
    const tracker = new CommandTracker();
    const startedAt = Date.now();
    const initialExitCode = process.exitCode ?? 0;

    // A telemetria e best-effort: qualquer falha ao registrar ou exportar o
    // evento e contida aqui, para nunca quebrar o comando nem mascarar o erro
    // real do handler.
    const emit = async (success: boolean): Promise<void> => {
        try {
            await emitTelemetryIfEnabled(
                options.fromMetaUrl,
                {
                    command: options.command,
                    success,
                    durationMs: Date.now() - startedAt,
                    properties: tracker.snapshot(),
                },
                { env: options.env },
            );
        } catch (error) {
            logTelemetryFailure(error, options.env ?? process.env);
        }
    };

    try {
        const result = await options.handler(tracker);
        const exitCode = process.exitCode ?? initialExitCode;
        await emit(exitCode === 0);
        return result;
    } catch (error) {
        tracker.set(
            "failureKind",
            error instanceof Error ? error.name : "unknown",
        );
        await emit(false);
        throw error;
    }
}
