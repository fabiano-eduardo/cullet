export function hasModuleMockCall(src: string, file?: string): boolean;

export interface KitEntry {
    kitName: string;
    packageName: string;
    version: string;
    packageDir: string;
    packageJsonPath: string;
    metaPath: string;
    sourceDir: string;
    kind: string;
    isTooling: boolean;
}

export interface KitFinding {
    severity: "error" | "warn";
    msg: string;
    file?: string;
}

export function buildKitEntry(packageDir: string): Promise<KitEntry | null>;

export function validateKit(
    kit: KitEntry,
    schema: unknown,
): Promise<{ kit: KitEntry; findings: KitFinding[] }>;
