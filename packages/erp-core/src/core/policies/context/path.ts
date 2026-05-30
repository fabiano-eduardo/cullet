/**
 * Utilities for reading/writing values at dot-separated paths
 * in plain objects, e.g. "installment.dueDate".
 */

import { Result } from "../../result/result";

export class PolicyContextPath {
  private static readonly FORBIDDEN_SEGMENTS = new Set([
    "__proto__",
    "prototype",
    "constructor",
  ]);

  private static resolve(
    obj: Record<string, unknown>,
    path: string,
  ): Result<
    {
      readonly found: boolean;
      readonly value: unknown;
    },
    string
  > {
    const segmentsResult = PolicyContextPath.parseSegments(path);
    if (segmentsResult.isErr()) {
      return Result.err(segmentsResult.errorOrNull()!);
    }

    const segments = segmentsResult.getOrNull()!;
    let current: unknown = obj;

    for (const segment of segments) {
      if (
        current === null ||
        current === undefined ||
        typeof current !== "object"
      ) {
        return Result.ok({ found: false, value: undefined });
      }

      const record = current as Record<string, unknown>;
      if (!Object.prototype.hasOwnProperty.call(record, segment)) {
        return Result.ok({ found: false, value: undefined });
      }

      current = record[segment];
    }

    return Result.ok({ found: true, value: current });
  }

  private static parseSegments(
    path: string,
  ): Result<readonly string[], string> {
    if (path.trim().length === 0) {
      return Result.err("Path cannot be empty");
    }

    const segments = path.split(".");
    if (segments.some((segment) => segment.length === 0)) {
      return Result.err(`Path "${path}" contains an empty segment`);
    }

    const forbiddenSegment = segments.find((segment) =>
      PolicyContextPath.FORBIDDEN_SEGMENTS.has(segment),
    );
    if (forbiddenSegment !== undefined) {
      return Result.err(
        `Path "${path}" contains forbidden segment "${forbiddenSegment}"`,
      );
    }

    return Result.ok(segments);
  }

  private static isPlainRecord(
    value: unknown,
  ): value is Record<string, unknown> {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      return false;
    }

    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  }

  static getOrAbsent(
    obj: Record<string, unknown>,
    path: string,
  ): Result<unknown, "absent"> {
    const resolvedPath = PolicyContextPath.resolve(obj, path);
    if (resolvedPath.isErr()) {
      return Result.err("absent");
    }

    const { found, value } = resolvedPath.getOrNull()!;
    if (!found) {
      return Result.err("absent");
    }

    return Result.ok(value);
  }

  static has(obj: Record<string, unknown>, path: string): boolean {
    const resolvedPath = PolicyContextPath.resolve(obj, path);
    if (resolvedPath.isErr()) {
      return false;
    }

    return resolvedPath.getOrNull()!.found;
  }

  static set(
    obj: Record<string, unknown>,
    path: string,
    value: unknown,
  ): Result<void, string> {
    const segmentsResult = PolicyContextPath.parseSegments(path);
    if (segmentsResult.isErr()) {
      return Result.err(segmentsResult.errorOrNull()!);
    }

    const segments = segmentsResult.getOrNull()!;
    let current: Record<string, unknown> = obj;

    for (let i = 0; i < segments.length - 1; i++) {
      const seg = segments[i];
      const next = current[seg];

      if (next === undefined) {
        const container = Object.create(null) as Record<string, unknown>;
        current[seg] = container;
        current = container;
        continue;
      }

      if (!PolicyContextPath.isPlainRecord(next)) {
        return Result.err(
          `Cannot create nested path "${path}" because "${segments
            .slice(0, i + 1)
            .join(".")}" already contains a non-plain object`,
        );
      }

      current = next;
    }

    current[segments[segments.length - 1]] = value;
    return Result.ok(undefined);
  }
}
