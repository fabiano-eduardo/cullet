import {
    DEFAULT_KIT_KIND,
    type KitCopyDelivery,
    type KitDependency,
    type KitKind,
    type KitMeta,
} from "./types.js";

function cloneKitDependencies(dependencies: KitDependency[]): KitDependency[] {
    return dependencies.map((dependency) => ({ ...dependency }));
}

function fallbackKitDependencies(names: string[] | undefined): KitDependency[] {
    if (names === undefined) return [];

    return names.map((name) => ({ name, range: "" }));
}

export function getDirectImportPeerDependencies(
    meta: KitMeta | null | undefined,
): KitDependency[] {
    const dependencies = meta?.compatibility?.directImport.peerDependencies;

    return dependencies !== undefined
        ? cloneKitDependencies(dependencies)
        : fallbackKitDependencies(meta?.philosophy?.externalDeps);
}

export function getFullControlDependencies(
    meta: KitMeta | null | undefined,
): KitDependency[] {
    const dependencies = meta?.compatibility?.fullControl.dependencies;

    return dependencies !== undefined
        ? cloneKitDependencies(dependencies)
        : fallbackKitDependencies(meta?.philosophy?.externalDeps);
}

/** Resolve a kit's kind, defaulting to `foundation` when unset. */
export function getKitKind(meta: KitMeta | null | undefined): KitKind {
    return meta?.kind ?? DEFAULT_KIT_KIND;
}

/** True when the kit is delivered by copying a payload rather than importing. */
export function isToolingKit(meta: KitMeta | null | undefined): boolean {
    return getKitKind(meta) === "tooling";
}

export function getCopyDelivery(
    meta: KitMeta | null | undefined,
): KitCopyDelivery | undefined {
    const copy = meta?.delivery?.copy;
    if (copy === undefined) return undefined;
    return {
        placement: copy.placement,
        source: copy.source,
        dependencies: cloneKitDependencies(copy.dependencies),
        ...(copy.postInstall !== undefined
            ? { postInstall: copy.postInstall }
            : {}),
    };
}

/** Consumer-relative destination directory for a copy-only kit, if declared. */
export function getCopyPlacement(
    meta: KitMeta | null | undefined,
): string | undefined {
    return meta?.delivery?.copy?.placement;
}

/** External dependencies a copy-only kit's payload needs in the consumer. */
export function getCopyDependencies(
    meta: KitMeta | null | undefined,
): KitDependency[] {
    const dependencies = meta?.delivery?.copy?.dependencies;
    return dependencies !== undefined ? cloneKitDependencies(dependencies) : [];
}

/**
 * True when a `tooling` kit opts into an importable surface (e.g. a typed
 * config helper) by declaring `delivery.import`. Such kits stay copy-first but
 * can also be consumed straight from node_modules with `import`, no copy.
 */
export function kitExposesImport(meta: KitMeta | null | undefined): boolean {
    return meta?.delivery?.import !== undefined;
}

/** Peer dependencies a kit's importable surface needs in the consumer. */
export function getImportPeerDependencies(
    meta: KitMeta | null | undefined,
): KitDependency[] {
    const dependencies = meta?.delivery?.import?.peerDependencies;
    return dependencies !== undefined ? cloneKitDependencies(dependencies) : [];
}
