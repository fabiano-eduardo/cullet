import { InvariantViolationException } from "../../exceptions/invariant-violation-exception";
import { makeImmutable } from "../../shared/immutable";
import { assertValidDate } from "../../shared/temporal-guards";

/**
 * Represents business time (Valid Time).
 * Defines when a piece of information is considered true or in effect in the real world.
 */
interface ValidTime {
  /** Start of the validity window (inclusive). */
  readonly from: Date;
  /** End of the validity window (exclusive). When absent, the information is still in effect. */
  readonly to?: Date;
}

type CreateValidTimeInput = ValidTime;

function assertValidTime(
  validTime: ValidTime,
  fieldName: string = "validTime",
): void {
  assertValidDate(`${fieldName}.from`, validTime.from);

  if (validTime.to === undefined) {
    return;
  }

  assertValidDate(`${fieldName}.to`, validTime.to);

  if (validTime.to.getTime() <= validTime.from.getTime()) {
    throw new InvariantViolationException(
      `${fieldName}.to must be later than ${fieldName}.from`,
    );
  }
}

function createValidTime(input: CreateValidTimeInput): ValidTime {
  assertValidTime(input, "validTime");

  if (input.to === undefined) {
    return makeImmutable({
      from: input.from,
    });
  }

  return makeImmutable({
    from: input.from,
    to: input.to,
  });
}

export {
  assertValidTime,
  createValidTime,
  type CreateValidTimeInput,
  type ValidTime,
};
