export interface RegistryEntry {
    versions: string[];
    latest: string;
    description: string;
    /** npm package name for this kit (e.g. "@cullet/erp-core"). Falls back to "cullet/<name>" for legacy entries without the field. */
    npmName: string;
}

export type Registry = Record<string, RegistryEntry>;

export interface KitDeprecation {
    since: string;
    reason: string;
    successor?: KitSuccessor;
}

export interface KitSuccessorCodemod {
    path: string;
    description?: string;
}

export interface KitSuccessor {
    name: string;
    version: string;
    notes?: string;
    guide?: string;
    codemod?: KitSuccessorCodemod;
}

export interface KitDependency {
    name: string;
    range: string;
    optional?: boolean;
    notes?: string;
}

export interface KitCompatibility {
    engines: {
        node: string;
        typescript: string;
    };
    directImport: {
        peerDependencies: KitDependency[];
    };
    fullControl: {
        dependencies: KitDependency[];
    };
}

/**
 * Nature of a kit. `foundation`/`capability` are importable TypeScript
 * libraries; `tooling` is a copy-only kit (no entryPoint/exports), delivered by
 * copying a payload directory into the consumer project. Absent ⇒ treated as
 * `foundation` so existing kits keep their behavior.
 */
export type KitKind = "foundation" | "capability" | "tooling";

export const DEFAULT_KIT_KIND: KitKind = "foundation";

export interface KitCopyDelivery {
    /** Destination directory in the consumer project, relative to its cwd. */
    placement: string;
    /** Directory inside the kit package holding the payload. Defaults to "files". */
    source: string;
    /** Optional script (relative to the copied payload) run once after the copy. */
    postInstall?: string;
    /** External dependencies the consumer must install for the payload to work. */
    dependencies: KitDependency[];
}

export interface KitDelivery {
    import?: {
        peerDependencies: KitDependency[];
    };
    copy?: KitCopyDelivery;
}

export interface KitMeta {
    schemaVersion?: string;
    kind?: KitKind;
    name?: string;
    version?: string;
    description?: string;
    compatibility?: KitCompatibility;
    delivery?: KitDelivery;
    philosophy?: {
        externalDeps?: string[];
        testDeps?: string[];
    };
    /**
     * Curated headline exports of an importable kit — a subset of the full
     * public surface, validated by scripts/validate-kit.mjs and surfaced by
     * `cullet info`. Absent for copy-only tooling kits.
     */
    exports?: string[];
}

export const KIT_KINDS: ReadonlySet<string> = new Set([
    "foundation",
    "capability",
    "tooling",
]);

export const DEFAULT_COPY_SOURCE_DIR = "files";
