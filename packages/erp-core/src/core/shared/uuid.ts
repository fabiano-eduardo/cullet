/**
 * Canonical RFC-4122 UUID (versions 1–5, variant 8/9/a/b), matched
 * case-insensitively. The single source of truth for the UUID format —
 * `UuidIdentifier` (domain ids) and `RequestedBy` (command actor) both
 * validate against this pattern, so an identity accepted at the application
 * boundary is always one the domain also considers valid.
 */
const UUID_PATTERN =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export { UUID_PATTERN };
