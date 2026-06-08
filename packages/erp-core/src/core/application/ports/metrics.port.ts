type MetricLabels = Readonly<Record<string, string | number | boolean>>;

interface MetricsPort {
    counter(name: string, value: number, labels?: MetricLabels): void;
    gauge(name: string, value: number, labels?: MetricLabels): void;
    histogram(name: string, value: number, labels?: MetricLabels): void;
}

export type { MetricLabels, MetricsPort };
