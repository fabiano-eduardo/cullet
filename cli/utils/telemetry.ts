import { randomUUID } from "node:crypto";
import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { findCulletPackageRoot } from "./resolve.js";

export type TelemetryProperty = boolean | number | string;

export interface TelemetryConfig {
  enabled: boolean;
  anonymousId?: string;
  endpoint?: string;
}

export interface TelemetryStatus {
  enabled: boolean;
  anonymousId?: string;
  endpoint?: string;
  configPath: string;
  localLogPath: string;
}

export interface TelemetryEventInput {
  command: string;
  success: boolean;
  durationMs: number;
  properties?: Record<string, TelemetryProperty>;
}

export interface TelemetryCommandTracker {
  set(name: string, value: TelemetryProperty | undefined): void;
}

interface TelemetryEnvelope {
  event: "cli.command";
  timestamp: string;
  anonymousId: string;
  cliVersion: string;
  command: string;
  success: boolean;
  durationMs: number;
  system: {
    platform: NodeJS.Platform;
    nodeVersion: string;
    arch: string;
  };
  properties: Record<string, TelemetryProperty>;
}

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

let cachedCliVersion: string | null = null;

function resolveHomeDir(env: NodeJS.ProcessEnv): string {
  if (typeof env.HOME === "string" && env.HOME.length > 0) {
    return env.HOME;
  }

  throw new Error(
    "HOME nao esta definido; nao foi possivel resolver a telemetria do cullet.",
  );
}

function resolveConfigDir(env: NodeJS.ProcessEnv): string {
  if (
    typeof env.CULLET_CONFIG_HOME === "string" &&
    env.CULLET_CONFIG_HOME.length > 0
  ) {
    return join(env.CULLET_CONFIG_HOME, "cullet");
  }

  if (
    typeof env.XDG_CONFIG_HOME === "string" &&
    env.XDG_CONFIG_HOME.length > 0
  ) {
    return join(env.XDG_CONFIG_HOME, "cullet");
  }

  return join(resolveHomeDir(env), ".config", "cullet");
}

function resolveStateDir(env: NodeJS.ProcessEnv): string {
  if (
    typeof env.CULLET_STATE_HOME === "string" &&
    env.CULLET_STATE_HOME.length > 0
  ) {
    return join(env.CULLET_STATE_HOME, "cullet");
  }

  if (typeof env.XDG_STATE_HOME === "string" && env.XDG_STATE_HOME.length > 0) {
    return join(env.XDG_STATE_HOME, "cullet");
  }

  return join(resolveHomeDir(env), ".local", "state", "cullet");
}

export function resolveTelemetryConfigPath(
  env: NodeJS.ProcessEnv = process.env,
): string {
  return join(resolveConfigDir(env), "telemetry.json");
}

export function resolveTelemetryLogPath(
  env: NodeJS.ProcessEnv = process.env,
): string {
  return join(resolveStateDir(env), "events.ndjson");
}

async function loadCliVersion(fromMetaUrl: string): Promise<string> {
  if (cachedCliVersion !== null) {
    return cachedCliVersion;
  }

  try {
    const packageRoot = findCulletPackageRoot(fromMetaUrl);
    const raw = await readFile(join(packageRoot, "package.json"), "utf8");
    const parsed = JSON.parse(raw) as { version?: unknown };
    cachedCliVersion =
      typeof parsed.version === "string" ? parsed.version : "unknown";
  } catch {
    cachedCliVersion = "unknown";
  }

  return cachedCliVersion;
}

async function readTelemetryConfigFile(
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
        typeof parsed.anonymousId === "string" ? parsed.anonymousId : undefined,
      endpoint:
        typeof parsed.endpoint === "string" ? parsed.endpoint : undefined,
    };
  } catch {
    return { enabled: false };
  }
}

async function writeTelemetryConfigFile(
  env: NodeJS.ProcessEnv,
  config: TelemetryConfig,
): Promise<void> {
  const configPath = resolveTelemetryConfigPath(env);
  await mkdir(dirname(configPath), { recursive: true });
  await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
}

function toStatus(
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

async function appendLocalEvent(
  env: NodeJS.ProcessEnv,
  payload: TelemetryEnvelope,
): Promise<void> {
  const logPath = resolveTelemetryLogPath(env);
  await mkdir(dirname(logPath), { recursive: true });
  await appendFile(logPath, `${JSON.stringify(payload)}\n`, "utf8");
}

async function postRemoteEvent(
  endpoint: string,
  payload: TelemetryEnvelope,
): Promise<void> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2000);

  try {
    await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
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
  const next: TelemetryConfig = {
    enabled: true,
    anonymousId: current.anonymousId ?? randomUUID(),
    endpoint: options.endpoint ?? current.endpoint,
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
      } catch {
        // best-effort remote export; local log already contains the event
      }
    }

    return true;
  } catch {
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

  try {
    const result = await options.handler(tracker);
    const exitCode = process.exitCode ?? initialExitCode;
    await emitTelemetryIfEnabled(
      options.fromMetaUrl,
      {
        command: options.command,
        success: exitCode === 0,
        durationMs: Date.now() - startedAt,
        properties: tracker.snapshot(),
      },
      { env: options.env },
    );
    return result;
  } catch (error) {
    tracker.set("failureKind", error instanceof Error ? error.name : "unknown");
    await emitTelemetryIfEnabled(
      options.fromMetaUrl,
      {
        command: options.command,
        success: false,
        durationMs: Date.now() - startedAt,
        properties: tracker.snapshot(),
      },
      { env: options.env },
    );
    throw error;
  }
}
