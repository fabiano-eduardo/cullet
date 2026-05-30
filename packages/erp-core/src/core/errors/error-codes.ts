const ErrorCodes = {
  authentication: {
    missingToken: "sec.authn.missing_token",
    invalidToken: "sec.authn.invalid_token",
    expiredToken: "sec.authn.expired_token",
    invalidCredentials: "sec.authn.invalid_credentials",
  },
  authorization: {
    forbidden: "sec.authz.forbidden",
    policyDenied: "sec.authz.policy_denied",
    missingCapability: "sec.authz.missing_capability",
    outOfScope: "sec.authz.out_of_scope",
  },
  businessRuleViolation: "business_rule_violation",
  conflict: {
    alreadyExists: "conf.already_exists",
    duplicate: "conf.duplicate",
    uniqueViolation: "conf.unique_violation",
  },
  idempotency: {
    keyMissing: "idemp.key_missing",
    inProgress: "idemp.in_progress",
    payloadMismatch: "idemp.payload_mismatch",
    replayNotSupported: "idemp.replay_not_supported",
  },
  integration: {
    timeout: "int.timeout",
    unreachable: "int.unreachable",
    badResponse: "int.bad_response",
  },
  legacyIncompatible: "legacy_incompatible",
  notFound: "not_found",
  serialization: {
    deserializePrefix: "ser.des",
    serializePrefix: "ser.ser",
  },
  temporal: {
    expired: "tmp.expired",
    notYetValid: "tmp.not_yet_valid",
  },
  unexpected: "unexpected",
  validation: "validation_error",
} as const;

type SerializationCodeDirection = "deserialize" | "serialize";

function serializationErrorCode(
  direction: SerializationCodeDirection,
  category: string,
): string {
  const prefix =
    direction === "deserialize"
      ? ErrorCodes.serialization.deserializePrefix
      : ErrorCodes.serialization.serializePrefix;

  return `${prefix}.${category}`;
}

export { ErrorCodes, serializationErrorCode };
export type { SerializationCodeDirection };
