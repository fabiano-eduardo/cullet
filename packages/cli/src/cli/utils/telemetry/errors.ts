/**
 * Classificacao de erros da telemetria. Falhas "ignoraveis" (arquivo ausente
 * ou JSON corrompido) sao esperadas e tratadas como telemetria desligada; o
 * restante e inesperado e deve ser propagado pelo chamador.
 */

export function hasErrorCode(error: unknown, code: string): boolean {
    return (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === code
    );
}

export function isIgnorableTelemetryError(error: unknown): boolean {
    return hasErrorCode(error, "ENOENT") || error instanceof SyntaxError;
}
