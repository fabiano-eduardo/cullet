import {
  type AppError,
  BusinessRuleViolationError,
  NotFoundError,
  UnexpectedError,
} from "../errors";
import type { PolicyEvaluationError } from "../policies";

export function mapPolicyEvaluationError(err: PolicyEvaluationError): AppError {
  switch (err.kind) {
    case "INVALID_CONTEXT":
      return new BusinessRuleViolationError(
        `policy.${err.stage.toLowerCase()}`,
        err.message,
        { policyKey: err.policyKey, stage: err.stage },
        { cause: err.cause },
      );
    case "INVALID_POLICY_KEY":
      return new BusinessRuleViolationError(
        "policy.invalid_key",
        err.message,
        { rawPolicyKey: err.rawPolicyKey },
        { cause: err.cause },
      );
    case "POLICY_NOT_FOUND":
      return new NotFoundError(
        "Policy",
        { policyKey: err.policyKey },
        { cause: err.cause },
      );
    case "POLICY_DEFINITION_NOT_FOUND":
      return new NotFoundError(
        "PolicyDefinition",
        {
          policyKey: err.policyKey,
          contextVersion: err.contextVersion,
          asOf: err.asOf.toISOString(),
        },
        { cause: err.cause },
      );
    case "POLICY_VARIANT_NOT_FOUND":
      return new NotFoundError(
        "PolicyVariant",
        {
          policyKey: err.policyKey,
          policyKind: err.policyKind,
          payloadSchemaVersion: err.payloadSchemaVersion,
        },
        { cause: err.cause },
      );
    case "ENGINE_FAILURE":
      return new UnexpectedError(err.message, err.cause, {
        metadata: {
          policyKey: err.policyKey,
          engine: err.engine,
          engineVersion: err.engineVersion,
        },
      });
  }
}
