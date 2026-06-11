import { type PackageManager } from "../../utils/package-manager.js";
import { type KitMeta } from "../../utils/resolve.js";
import { type TelemetryCommandTracker } from "../../utils/telemetry.js";

export interface FullControlOptions {
    dryRun?: boolean;
    // Commander maps `--no-install` to `install: false` (defaults to true).
    install?: boolean;
}

export interface FullControlContext {
    name: string;
    version: string;
    npmName: string;
    meta: KitMeta | null;
    installSpec: string;
    alreadyInstalled: boolean;
    packageManager: PackageManager;
    options: FullControlOptions;
    tracker: TelemetryCommandTracker;
}
