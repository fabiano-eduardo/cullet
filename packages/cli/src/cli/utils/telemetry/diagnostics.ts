/**
 * Diagnostico da telemetria. As mensagens de falha so vao para o stderr quando
 * o modo verboso esta ligado (via CULLET_VERBOSE/CULLET_TELEMETRY_VERBOSE ou
 * --verbose), para nunca poluir a saida normal dos comandos.
 */

const VERBOSE_ENV_ENABLED_VALUES = new Set(["1", "on", "true", "yes"]);

function isVerboseTelemetryEnabled(env: NodeJS.ProcessEnv): boolean {
    const configured = env.CULLET_VERBOSE ?? env.CULLET_TELEMETRY_VERBOSE;
    if (typeof configured === "string") {
        return VERBOSE_ENV_ENABLED_VALUES.has(configured.trim().toLowerCase());
    }

    return process.argv.includes("--verbose");
}

function writeTelemetryDiagnostic(
    message: string,
    env: NodeJS.ProcessEnv,
): void {
    if (!isVerboseTelemetryEnabled(env)) {
        return;
    }

    try {
        process.stderr.write(`[cullet telemetry] ${message}\n`);
    } catch {
        return;
    }
}

export function logRemoteTelemetryFailure(
    endpoint: string,
    error: unknown,
    env: NodeJS.ProcessEnv,
): void {
    const detail = error instanceof Error ? error.message : String(error);
    writeTelemetryDiagnostic(
        `Falha ao exportar evento para ${endpoint}: ${detail}`,
        env,
    );
}

export function logTelemetryFailure(
    error: unknown,
    env: NodeJS.ProcessEnv,
): void {
    const detail = error instanceof Error ? error.message : String(error);
    writeTelemetryDiagnostic(
        `Falha ao registrar evento de telemetria: ${detail}`,
        env,
    );
}
