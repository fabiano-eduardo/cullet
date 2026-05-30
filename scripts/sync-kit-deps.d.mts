export interface KitPackageEntry {
  kitName: string;
  dir: string;
  metaPath: string;
  packageJsonPath: string;
}

export interface KitPeerDependencyDrift extends KitPackageEntry {
  currentPeerDependencies: Record<string, string>;
  expectedPeerDependencies: Record<string, string>;
}

export interface SyncKitPeerDependenciesResult {
  checked: string[];
  drift: KitPeerDependencyDrift[];
  updated: string[];
}

export function buildPeerDependenciesMap(meta: {
  compatibility?: {
    directImport?: {
      peerDependencies?: Array<{
        name: string;
        range: string;
      }>;
    };
  };
}): Record<string, string>;

export function collectKitPackageEntries(
  packagesRoot?: string,
): Promise<KitPackageEntry[]>;

export function syncKitPeerDependencies(
  packagesRoot?: string,
  options?: {
    check?: boolean;
  },
): Promise<SyncKitPeerDependenciesResult>;

export function main(argv?: string[], packagesRoot?: string): Promise<number>;
