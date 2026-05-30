import { InvariantViolationException } from "../../exceptions/invariant-violation-exception";
import { assertValidDate } from "../../shared/temporal-guards";

import { assertValidTime, type ValidTime } from "./valid-time";

/**
 * Checks whether a temporal range is "open" (has no end date).
 * Useful for identifying information that is still in effect / active.
 */
function isOpen(range: ValidTime): boolean {
  assertValidTime(range, "range");

  return range.to === undefined;
}

/**
 * Checks whether a temporal range is "closed" (has a defined end date).
 */
function isClosed(range: ValidTime): boolean {
  return !isOpen(range);
}

/**
 * Checks whether a specific date is contained within the temporal range.
 * The lower bound (`from`) is inclusive, while the upper bound (`to`) is exclusive.
 */
function contains(range: ValidTime, date: Date): boolean {
  assertValidTime(range, "range");
  assertValidDate("date", date);

  const fromTime = range.from.getTime();
  const toTime = range.to?.getTime() ?? Number.POSITIVE_INFINITY;
  const targetTime = date.getTime();

  return targetTime >= fromTime && targetTime < toTime;
}

/**
 * Checks whether two temporal ranges overlap at any point.
 * Useful for validating whether a new rule conflicts with an existing one.
 */
function overlaps(left: ValidTime, right: ValidTime): boolean {
  assertValidTime(left, "left");
  assertValidTime(right, "right");

  const leftFrom = left.from.getTime();
  const leftTo = left.to?.getTime() ?? Number.POSITIVE_INFINITY;
  const rightFrom = right.from.getTime();
  const rightTo = right.to?.getTime() ?? Number.POSITIVE_INFINITY;

  return leftFrom < rightTo && rightFrom < leftTo;
}

export { contains, isClosed, isOpen, overlaps };
