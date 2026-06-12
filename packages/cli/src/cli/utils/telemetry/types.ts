/**
 * Tipos compartilhados da telemetria do CLI: a forma da configuracao
 * persistida, do status reportado ao usuario, do evento de entrada e do
 * envelope efetivamente registrado/enviado.
 */

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

export interface TelemetryEnvelope {
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
