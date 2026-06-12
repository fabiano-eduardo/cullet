/**
 * Transporte remoto da telemetria: faz POST do envelope para o endpoint HTTPS,
 * abortando apos 2s, consumindo o corpo da resposta e transformando respostas
 * nao-ok em erro para o chamador tratar.
 */
import { normalizeTelemetryEndpoint } from "./endpoint.js";
import type { TelemetryEnvelope } from "./types.js";

async function readTelemetryResponseText(response: Response): Promise<string> {
    try {
        return await response.text();
    } catch {
        return "";
    }
}

function formatTelemetryResponseError(
    status: number,
    responseBody: string,
): string {
    const trimmedBody = responseBody.trim();
    if (trimmedBody.length === 0) {
        return `O endpoint de telemetria respondeu com status ${status}.`;
    }

    const preview =
        trimmedBody.length > 500
            ? `${trimmedBody.slice(0, 497)}...`
            : trimmedBody;

    return `O endpoint de telemetria respondeu com status ${status}. Corpo: ${preview}`;
}

export async function postRemoteEvent(
    endpoint: string,
    payload: TelemetryEnvelope,
): Promise<void> {
    const normalizedEndpoint = normalizeTelemetryEndpoint(endpoint);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);

    try {
        const response = await fetch(normalizedEndpoint, {
            method: "POST",
            headers: {
                "content-type": "application/json",
            },
            body: JSON.stringify(payload),
            signal: controller.signal,
        });

        const responseBody = await readTelemetryResponseText(response);

        if (!response.ok) {
            throw new Error(
                formatTelemetryResponseError(response.status, responseBody),
            );
        }
    } finally {
        clearTimeout(timeout);
    }
}
