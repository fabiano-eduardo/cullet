import { InvariantViolationException } from "../exceptions/invariant-violation-exception.js";

/**
 * A structural contract version in `MAJOR.MINOR` form (e.g. `"1.0"`, `"2.5"`).
 *
 * The template-literal type is intentionally loose — it also accepts strings
 * the module rejects at runtime (e.g. `"1.0.0"` matches as `1` · `.` · `0.0`).
 * The runtime regex in {@link version} is the real guard; the type is only a
 * light hint.
 */
type ContractVersion = `${number}.${number}`;

/** Anything a class decorator can stamp a static property onto. */
type VersionedTarget = {
    readonly prototype: object;
};

const CONTRACT_VERSION_PROPERTY = "CONTRACT_VERSION" as const;
const CONTRACT_VERSION_PATTERN = /^\d+\.\d+$/;

/**
 * Class decorator that stamps a `MAJOR.MINOR` structural contract version onto
 * the class as a static `CONTRACT_VERSION` property.
 *
 * The property is defined **non-writable, non-configurable and non-enumerable**
 * on purpose: it must not be reassigned or redefined (tampering with a contract
 * version silently corrupts migration decisions), and keeping it off enumeration
 * excludes it from `JSON.stringify`/`for..in`. A consequence of
 * `configurable: false` is that decorating the same class twice throws
 * `TypeError: Cannot redefine property` — a deliberate fail-fast.
 *
 * Note on inheritance: a subclass that is not re-decorated inherits its base's
 * `CONTRACT_VERSION` through the static prototype chain. Re-decorate any
 * subclass whose persisted shape diverges from its base.
 *
 * @throws {InvariantViolationException} When `contractVersion` is not
 *   `MAJOR.MINOR` (validated at module-load time, when the decorator runs).
 */
function version<const TVersion extends ContractVersion>(
    contractVersion: TVersion,
) {
    if (!CONTRACT_VERSION_PATTERN.test(contractVersion)) {
        throw new InvariantViolationException(
            `Invalid contract version "${contractVersion}". Expected MAJOR.MINOR.`,
        );
    }

    return (target: VersionedTarget): void => {
        Object.defineProperty(target, CONTRACT_VERSION_PROPERTY, {
            value: contractVersion,
            writable: false,
            configurable: false,
            enumerable: false,
        });
    };
}

export {
    CONTRACT_VERSION_PROPERTY,
    type ContractVersion,
    version,
    type VersionedTarget,
};
