/**
 * Canonical RFC-4122 / RFC-9562 UUID, matched case-insensitively. Accepts
 * versions 1–8 (variant 8/9/a/b) — notably UUIDv7, the time-ordered default for
 * sortable primary keys in modern schemas. The nil (`0000…`) and max (`ffff…`)
 * UUIDs are intentionally rejected: they are sentinels, not real identities, and
 * a domain id should never carry one.
 *
 * The single source of truth for the UUID format — `UuidIdentifier` (domain ids)
 * and `RequestedBy` (command actor) both validate against this pattern, so an
 * identity accepted at the application boundary is always one the domain also
 * considers valid.
 */
const UUID_PATTERN =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export { UUID_PATTERN };
