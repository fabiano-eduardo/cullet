// Semver without build metadata: comparisons are defined only over
// major.minor.patch and optional pre-release identifiers (semver §11).
export const POLICY_SEMVER_PATTERN =
    /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;

interface ParsedSemver {
    major: number;
    minor: number;
    patch: number;
    preRelease: string | null;
}

function parseSemver(version: string): ParsedSemver {
    const withoutBuild = version.split("+")[0];

    // Split on the first hyphen only. A pre-release identifier may itself
    // contain hyphens (e.g. "1.0.0-x-1"); `split("-")` would drop everything
    // after the first one and corrupt the comparison.
    const dashIndex = withoutBuild.indexOf("-");
    const core =
        dashIndex === -1 ? withoutBuild : withoutBuild.slice(0, dashIndex);
    const preRelease =
        dashIndex === -1 ? null : withoutBuild.slice(dashIndex + 1);

    const [major, minor, patch] = core.split(".").map(Number) as [
        number,
        number,
        number,
    ];

    return { major, minor, patch, preRelease };
}

function comparePreRelease(a: string, b: string): number {
    const aIds = a.split(".");
    const bIds = b.split(".");
    const len = Math.max(aIds.length, bIds.length);

    for (let i = 0; i < len; i++) {
        const ai = aIds[i];
        const bi = bIds[i];

        // Shorter pre-release has lower precedence when prefix matches (semver §11.4.4)
        if (ai === undefined) return -1;
        if (bi === undefined) return 1;

        const aNum = Number(ai);
        const bNum = Number(bi);
        const aIsNum = !Number.isNaN(aNum);
        const bIsNum = !Number.isNaN(bNum);

        // Numeric identifiers always have lower precedence than alphanumeric (semver §11.4.1)
        if (aIsNum && !bIsNum) return -1;
        if (!aIsNum && bIsNum) return 1;

        if (aIsNum && bIsNum) {
            if (aNum !== bNum) return aNum - bNum;
        } else {
            if (ai < bi) return -1;
            if (ai > bi) return 1;
        }
    }

    return 0;
}

/**
 * Compares two valid semver strings.
 * Returns a negative number if a < b, 0 if a === b, positive if a > b.
 *
 * Callers are expected to pass only strings that already passed
 * `POLICY_SEMVER_PATTERN` validation (i.e. values stored in PolicyDefinition).
 */
export function comparePolicySemver(a: string, b: string): number {
    const av = parseSemver(a);
    const bv = parseSemver(b);

    if (av.major !== bv.major) return av.major - bv.major;
    if (av.minor !== bv.minor) return av.minor - bv.minor;
    if (av.patch !== bv.patch) return av.patch - bv.patch;

    // Release > pre-release (semver §11.3)
    if (av.preRelease === null && bv.preRelease !== null) return 1;
    if (av.preRelease !== null && bv.preRelease === null) return -1;
    if (av.preRelease !== null && bv.preRelease !== null) {
        return comparePreRelease(av.preRelease, bv.preRelease);
    }

    return 0;
}
