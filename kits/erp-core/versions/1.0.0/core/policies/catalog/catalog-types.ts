// ─── Enums / Literal unions ─────────────────────────────────────────────────

export type PolicyKind = "GATE" | "COMPUTE";

export type PolicyOwner = "PLATFORM_OWNER" | "TENANT_ADMIN" | "SCHOOL_ADMIN";

export type PolicyScopeLevel = "GLOBAL" | "TENANT" | "SCHOOL";

/**
 * Defines where the "as of" date comes from for a given policy.
 */
export type AsOfSource = "NOW" | "CALLER_PROVIDED";
