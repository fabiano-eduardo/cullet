import { describe, expect, it } from "vitest";

import { ValidationCode } from "../exceptions/validation-code";
import { ValidationField } from "../exceptions/validation-field";

import { AuthenticationError } from "./authentication-error";
import { AuthorizationError } from "./authorization-error";
import { ErrorCodes } from "./error-codes";
import { IntegrationError } from "./integration-error";
import { NotFoundError } from "./not-found-error";
import { UnexpectedError } from "./unexpected-error";
import { ValidationError } from "./validation-error";
import { NON_SERIALIZABLE_PLACEHOLDER } from "./utils";

describe("error catalog factories", () => {
  describe("happy path", () => {
    it("builds missing-token errors with stable authentication metadata", () => {
      const error = AuthenticationError.missingToken({
        authScheme: "bearer",
        tokenLocation: "header",
        correlationId: "corr-auth-1",
        createdAtIso: "2026-05-29T12:00:00.000Z",
      });

      expect(error.code).toBe(ErrorCodes.authentication.missingToken);
      expect(error.reason).toBe("missing_token");
      expect(error.correlationId).toBe("corr-auth-1");
      expect(error.createdAtIso).toBe("2026-05-29T12:00:00.000Z");
      expect(error.metadata).toEqual({
        reason: "missing_token",
        authScheme: "bearer",
        tokenLocation: "header",
        correlationId: "corr-auth-1",
        createdAtIso: "2026-05-29T12:00:00.000Z",
      });
    });

    it("builds invalid-token errors without placeholder metadata for omitted fields", () => {
      const cause = new Error("jwt malformed");
      const error = AuthenticationError.invalidToken({
        details: "signature mismatch",
        correlationId: "corr-auth-2",
        requestId: "req-auth-2",
        commandId: "cmd-auth-2",
        cause,
      });

      expect(error.code).toBe(ErrorCodes.authentication.invalidToken);
      expect(error.reason).toBe("invalid_token");
      expect(error.cause).toBe(cause);
      expect(error.commandId).toBe("cmd-auth-2");
      expect(error.metadata).toEqual({
        reason: "invalid_token",
        details: "signature mismatch",
        correlationId: "corr-auth-2",
        requestId: "req-auth-2",
      });
      expect(error.metadata).not.toHaveProperty("authScheme");
      expect(error.metadata).not.toHaveProperty("tokenLocation");
      expect(error.metadata).not.toHaveProperty("commandId");
    });

    it("builds expired-token errors and invalid-credentials errors with their audited codes", () => {
      const expiredToken = AuthenticationError.expiredToken({
        authScheme: "cookie",
        tokenLocation: "cookie",
        expiresAtIso: "2026-06-01T00:00:00.000Z",
      });
      const invalidCredentials = AuthenticationError.invalidCredentials({
        severity: "medium",
        publicMessage: "Credenciais invalidas.",
      });

      expect(expiredToken.code).toBe(ErrorCodes.authentication.expiredToken);
      expect(expiredToken.reason).toBe("expired_token");
      expect(expiredToken.metadata).toEqual({
        reason: "expired_token",
        authScheme: "cookie",
        tokenLocation: "cookie",
        expiresAtIso: "2026-06-01T00:00:00.000Z",
      });

      expect(invalidCredentials.code).toBe(
        ErrorCodes.authentication.invalidCredentials,
      );
      expect(invalidCredentials.reason).toBe("invalid_credentials");
      expect(invalidCredentials.publicMessage).toBe("Credenciais invalidas.");
      expect(invalidCredentials.metadata).toEqual({
        reason: "invalid_credentials",
        severity: "medium",
        publicMessage: "Credenciais invalidas.",
      });
    });

    it("builds authorization errors with stable reason metadata and top-level ids", () => {
      const forbidden = AuthorizationError.forbidden({
        action: "invoice.read",
        resource: { type: "invoice", id: "INV-1" },
        actor: { userId: "user-1", role: "viewer" },
        correlationId: "corr-authz-1",
        requestId: "req-authz-1",
      });
      const policyDenied = AuthorizationError.policyDenied({
        action: "invoice.approve",
        policyId: "policy-123",
        policyVersion: 2,
        evaluatedAtIso: "2026-05-29T12:00:00.000Z",
      });
      const missingCapability = AuthorizationError.missingCapability({
        action: "invoice.export",
        required: { capability: "invoice:export" },
      });
      const outOfScope = AuthorizationError.outOfScope({
        action: "invoice.read",
        resource: { type: "invoice", id: "INV-2" },
      });

      expect(forbidden.code).toBe(ErrorCodes.authorization.forbidden);
      expect(forbidden.reason).toBe("forbidden");
      expect(forbidden.correlationId).toBe("corr-authz-1");
      expect(forbidden.requestId).toBe("req-authz-1");
      expect(forbidden.metadata).toEqual({
        reason: "forbidden",
        action: "invoice.read",
        resource: { type: "invoice", id: "INV-1" },
        actor: { userId: "user-1", role: "viewer" },
      });
      expect(forbidden.metadata).not.toHaveProperty("correlationId");

      expect(policyDenied.code).toBe(ErrorCodes.authorization.policyDenied);
      expect(policyDenied.metadata).toEqual({
        reason: "policy_denied",
        action: "invoice.approve",
        policyId: "policy-123",
        policyVersion: 2,
        evaluatedAtIso: "2026-05-29T12:00:00.000Z",
        decision: "deny",
      });

      expect(missingCapability.code).toBe(
        ErrorCodes.authorization.missingCapability,
      );
      expect(missingCapability.metadata).toEqual({
        reason: "missing_capability",
        action: "invoice.export",
        required: { capability: "invoice:export" },
      });

      expect(outOfScope.code).toBe(ErrorCodes.authorization.outOfScope);
      expect(outOfScope.metadata).toEqual({
        reason: "out_of_scope",
        action: "invoice.read",
        resource: { type: "invoice", id: "INV-2" },
      });
    });

    it("builds integration errors with only the defined transport metadata", () => {
      const timeout = IntegrationError.timeout({
        provider: "payments-api",
        operation: "create_charge",
        startedAtIso: "2026-05-29T11:59:00.000Z",
        durationMs: 1200,
      });
      const unreachable = IntegrationError.unreachable({
        provider: "crm-api",
        operation: "sync_customer",
        startedAtIso: "2026-05-29T11:59:00.000Z",
        durationMs: 500,
        detectedAtIso: "2026-05-29T11:59:00.500Z",
        correlationId: "corr-int-1",
        requestId: "req-int-1",
        details: "ECONNREFUSED",
      });
      const badResponse = IntegrationError.badResponse({
        provider: "billing-api",
        operation: "issue_invoice",
        startedAtIso: "2026-05-29T11:59:00.000Z",
        durationMs: 800,
        statusCode: 502,
        responseCode: "BAD_GATEWAY",
      });

      expect(timeout.code).toBe(ErrorCodes.integration.timeout);
      expect(timeout.reason).toBe("timeout");
      expect(timeout.metadata).toEqual({
        reason: "timeout",
        provider: "payments-api",
        operation: "create_charge",
        startedAtIso: "2026-05-29T11:59:00.000Z",
        durationMs: 1200,
      });

      expect(unreachable.code).toBe(ErrorCodes.integration.unreachable);
      expect(unreachable.correlationId).toBe("corr-int-1");
      expect(unreachable.requestId).toBe("req-int-1");
      expect(unreachable.metadata).toEqual({
        reason: "unreachable",
        provider: "crm-api",
        operation: "sync_customer",
        startedAtIso: "2026-05-29T11:59:00.000Z",
        durationMs: 500,
        detectedAtIso: "2026-05-29T11:59:00.500Z",
        correlationId: "corr-int-1",
        requestId: "req-int-1",
        details: "ECONNREFUSED",
      });

      expect(badResponse.code).toBe(ErrorCodes.integration.badResponse);
      expect(badResponse.metadata).toEqual({
        reason: "bad_response",
        provider: "billing-api",
        operation: "issue_invoice",
        startedAtIso: "2026-05-29T11:59:00.000Z",
        durationMs: 800,
        statusCode: 502,
        responseCode: "BAD_GATEWAY",
      });
    });

    it("builds not-found, validation, and unexpected errors with their stable codes", () => {
      const notFound = new NotFoundError(
        "invoice",
        { id: "INV-404" },
        { metadata: { tenantId: "tenant-1" } },
      );
      const validation = new ValidationError(
        ValidationField.of("customer.email"),
        ValidationCode.INVALID_FORMAT,
        "customer.email has an invalid format",
        { metadata: { entity: "customer" } },
      );
      const cause = new Error("catalog corrupted");
      const unexpected = new UnexpectedError(undefined, cause, {
        type: "internal",
        publicMessage: "Tente novamente mais tarde.",
      });

      expect(notFound.code).toBe(ErrorCodes.notFound);
      expect(notFound.metadata).toEqual({
        resource: "invoice",
        criteria: { id: "INV-404" },
        tenantId: "tenant-1",
      });

      expect(validation.code).toBe(ErrorCodes.validation);
      expect(validation.metadata).toEqual({
        field: "customer.email",
        validationCode: "invalid_format",
        entity: "customer",
      });

      expect(unexpected.code).toBe(ErrorCodes.unexpected);
      expect(unexpected.message).toBe("Unexpected error");
      expect(unexpected.cause).toBe(cause);
      expect(unexpected.type).toBe("internal");
      expect(unexpected.publicMessage).toBe("Tente novamente mais tarde.");
    });
  });

  describe("error cases", () => {
    it("rejects non-plain metadata roots when the factory forwards metadata directly", () => {
      expect(
        () =>
          new UnexpectedError("boom", undefined, {
            metadata: new Date("2026-05-29T12:00:00.000Z") as unknown as Record<
              string,
              unknown
            >,
          }),
      ).toThrow(TypeError);
    });
  });

  describe("edge cases", () => {
    it("omits criteria when absent and sanitizes nested non-serializable metadata", () => {
      const error = new NotFoundError("invoice", undefined, {
        metadata: {
          debug: new Date("2026-05-29T12:00:00.000Z"),
        },
      });

      expect(error.metadata).toEqual({
        resource: "invoice",
        debug: NON_SERIALIZABLE_PLACEHOLDER,
      });
      expect(error.metadata).not.toHaveProperty("criteria");
    });
  });
});
