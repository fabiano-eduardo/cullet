/**
 * Camada de persistencia local da telemetria: leitura/escrita do arquivo de
 * configuracao, registro do evento no log NDJSON local e leitura cacheada da
 * versao do CLI. Arquivos gravados recebem permissao restrita ao dono (0o600).
 */
import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { findCulletPackageRoot } from "../resolve.js";
import { isIgnorableTelemetryError } from "./errors.js";
import { readConfiguredTelemetryEndpoint } from "./endpoint.js";
import {
    resolveTelemetryConfigPath,
    resolveTelemetryLogPath,
} from "./paths.js";
import type {
    TelemetryConfig,
    TelemetryEnvelope,
    TelemetryStatus,
} from "./types.js";

const TELEMETRY_FILE_MODE = 0o600;

let cachedCliVersion: string | null = null;

export async function readTelemetryConfigFile(
    env: NodeJS.ProcessEnv,
): Promise<TelemetryConfig> {
    try {
        const raw = await readFile(resolveTelemetryConfigPath(env), "utf8");
        const parsed = JSON.parse(raw) as {
            enabled?: unknown;
            anonymousId?: unknown;
            endpoint?: unknown;
        };

        return {
            enabled: parsed.enabled === true,
            anonymousId:
                typeof parsed.anonymousId === "string"
                    ? parsed.anonymousId
                    : undefined,
            endpoint: readConfiguredTelemetryEndpoint(parsed.endpoint),
        };
    } catch (error) {
        if (!isIgnorableTelemetryError(error)) {
            throw error;
        }

        return { enabled: false };
    }
}

export async function writeTelemetryConfigFile(
    env: NodeJS.ProcessEnv,
    config: TelemetryConfig,
): Promise<void> {
    const configPath = resolveTelemetryConfigPath(env);
    await mkdir(dirname(configPath), { recursive: true });
    await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, {
        encoding: "utf8",
        mode: TELEMETRY_FILE_MODE,
    });
}

export function toStatus(
    env: NodeJS.ProcessEnv,
    config: TelemetryConfig,
): TelemetryStatus {
    return {
        enabled: config.enabled,
        anonymousId: config.anonymousId,
        endpoint: config.endpoint,
        configPath: resolveTelemetryConfigPath(env),
        localLogPath: resolveTelemetryLogPath(env),
    };
}

export async function appendLocalEvent(
    env: NodeJS.ProcessEnv,
    payload: TelemetryEnvelope,
): Promise<void> {
    const logPath = resolveTelemetryLogPath(env);
    await mkdir(dirname(logPath), { recursive: true });
    await appendFile(logPath, `${JSON.stringify(payload)}\n`, {
        encoding: "utf8",
        mode: TELEMETRY_FILE_MODE,
    });
}

export async function loadCliVersion(fromMetaUrl: string): Promise<string> {
    if (cachedCliVersion !== null) {
        return cachedCliVersion;
    }

    try {
        const packageRoot = findCulletPackageRoot(fromMetaUrl);
        const raw = await readFile(join(packageRoot, "package.json"), "utf8");
        const parsed = JSON.parse(raw) as { version?: unknown };
        cachedCliVersion =
            typeof parsed.version === "string" ? parsed.version : "unknown";
    } catch (error) {
        if (!isIgnorableTelemetryError(error)) {
            throw error;
        }

        cachedCliVersion = "unknown";
    }

    return cachedCliVersion;
}
