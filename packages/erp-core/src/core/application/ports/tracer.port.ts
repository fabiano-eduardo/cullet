type TraceAttributeValue = string | number | boolean;

interface TraceSpan {
    setAttribute(key: string, value: TraceAttributeValue): void;
    recordException(error: unknown): void;
    end(): void;
}

interface TracerPort {
    startSpan(
        name: string,
        attributes?: Record<string, TraceAttributeValue>,
    ): TraceSpan;
}

export type { TraceAttributeValue, TraceSpan, TracerPort };
