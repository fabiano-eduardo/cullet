type LogPayload = Record<string, unknown>;

interface LoggerPort {
  debug(message: string, payload?: LogPayload): void;
  info(message: string, payload?: LogPayload): void;
  warn(message: string, payload?: LogPayload): void;
  error(message: string, payload?: LogPayload): void;
}

export type { LogPayload, LoggerPort };
