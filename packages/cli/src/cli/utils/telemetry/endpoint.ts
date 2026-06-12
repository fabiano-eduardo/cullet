/**
 * Normalizacao e validacao do endpoint remoto de telemetria: exige uma URL
 * HTTPS valida, tanto na configuracao informada pelo usuario quanto na que ja
 * esta gravada no arquivo de config.
 */

export function normalizeTelemetryEndpoint(endpoint: string): string {
    const candidate = endpoint.trim();
    if (candidate.length === 0) {
        throw new Error(
            "O endpoint de telemetria precisa ser uma URL HTTPS valida.",
        );
    }

    let url: URL;
    try {
        url = new URL(candidate);
    } catch {
        throw new Error(
            "O endpoint de telemetria precisa ser uma URL HTTPS valida.",
        );
    }

    if (url.protocol !== "https:") {
        throw new Error("O endpoint de telemetria precisa usar HTTPS.");
    }

    return url.toString();
}

export function readConfiguredTelemetryEndpoint(
    value: unknown,
): string | undefined {
    if (typeof value !== "string") {
        return undefined;
    }

    try {
        return normalizeTelemetryEndpoint(value);
    } catch {
        return undefined;
    }
}
