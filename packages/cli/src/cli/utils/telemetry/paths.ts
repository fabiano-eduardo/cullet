/**
 * Resolucao dos caminhos da telemetria. Respeita as sobrescritas via
 * CULLET_*_HOME e as convencoes XDG, com fallback para o diretorio do usuario
 * (HOME, USERPROFILE no Windows, ou o homedir resolvido pelo Node).
 */
import { homedir } from "node:os";
import { join } from "node:path";

function resolveHomeDir(env: NodeJS.ProcessEnv): string {
    if (typeof env.HOME === "string" && env.HOME.length > 0) {
        return env.HOME;
    }

    // Windows nao popula HOME; o diretorio do usuario fica em USERPROFILE.
    if (typeof env.USERPROFILE === "string" && env.USERPROFILE.length > 0) {
        return env.USERPROFILE;
    }

    // Ultimo recurso: o homedir resolvido pelo Node (cobre os casos em que nem
    // HOME nem USERPROFILE estao no ambiente, mas o SO conhece o usuario).
    const home = homedir();
    if (home.length > 0) {
        return home;
    }

    throw new Error(
        "Nao foi possivel resolver o diretorio do usuario para a telemetria do cullet.",
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

    if (
        typeof env.XDG_STATE_HOME === "string" &&
        env.XDG_STATE_HOME.length > 0
    ) {
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
