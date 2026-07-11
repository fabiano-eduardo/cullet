import { DomainException } from "../../exceptions/domain-exception.js";
import {
    type Ruleset,
    type RulesetRegistry as RulesetRegistryContract,
} from "./ruleset.contracts.js";

class RulesetRegistryError extends DomainException {}

/**
 * Runtime guard for the `RulesetId` shape (`name@major.minor`). The template
 * type only protects TypeScript callers — a JS consumer (or a cast) could
 * register `"foo"` or `"foo@1.5.2"`, and either would silently corrupt
 * {@link RulesetRegistry.getCurrent}'s version ordering via `NaN`/ignored
 * segments. Same idea as `CONTRACT_VERSION_PATTERN` in `versioning/version.ts`.
 */
const RULESET_ID_PATTERN = /^.+@\d+\.\d+$/;

function parseVersion(id: string): [number, number] {
    const atIdx = id.lastIndexOf("@");
    const versionStr = id.slice(atIdx + 1);
    const [major, minor] = versionStr.split(".").map(Number);
    return [major, minor];
}

class RulesetRegistry implements RulesetRegistryContract {
    private readonly _store = new Map<string, Ruleset>();
    private _sealed = false;

    register(ruleset: Ruleset): void {
        if (this._sealed) {
            throw new RulesetRegistryError(
                "Registry is sealed. No new rulesets can be registered.",
            );
        }
        if (!RULESET_ID_PATTERN.test(ruleset.id)) {
            throw new RulesetRegistryError(
                `Invalid ruleset id "${ruleset.id}". Expected "<name>@<major>.<minor>", e.g. "order-creation@1.0".`,
            );
        }
        if (this._store.has(ruleset.id)) {
            throw new RulesetRegistryError(
                `Ruleset with id "${ruleset.id}" is already registered.`,
            );
        }
        this._store.set(ruleset.id, ruleset);
    }

    seal(): void {
        this._sealed = true;
    }

    /**
     * Looks up a ruleset by exact id. The `T` parameter is a caller-asserted
     * cast, not a runtime check: asking for the wrong `T` compiles and returns
     * the object mistyped — the standard registry trade-off. Keep the id and
     * the expected type paired at the call site.
     */
    get<T extends Ruleset>(id: string): T {
        const ruleset = this._store.get(id);
        if (!ruleset) {
            const available = Array.from(this._store.keys()).join(", ");
            throw new RulesetRegistryError(
                `Ruleset "${id}" not found. Available: [${available}]`,
            );
        }
        return ruleset as T;
    }

    /**
     * Returns the highest `major.minor` version registered under `prefix`.
     * The same caller-asserted `T` cast as {@link get} applies.
     */
    getCurrent<T extends Ruleset>(prefix: string): T {
        const matchingEntries = Array.from(this._store.entries()).filter(
            ([key]) => key.startsWith(prefix + "@"),
        );

        if (matchingEntries.length === 0) {
            throw new RulesetRegistryError(
                `No rulesets found with prefix "${prefix}".`,
            );
        }

        const sorted = matchingEntries.sort(([a], [b]) => {
            const [aMajor, aMinor] = parseVersion(a);
            const [bMajor, bMinor] = parseVersion(b);
            if (aMajor !== bMajor) return aMajor - bMajor;
            return aMinor - bMinor;
        });

        return sorted[sorted.length - 1][1] as T;
    }
}

export { RulesetRegistry };
