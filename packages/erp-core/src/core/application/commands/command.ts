import { UseCase } from "../use-case.js";
import { version } from "../../versioning/version.js";
import type { Result } from "../../result/result.js";

import { RequestedBy } from "./requested-by.js";

interface CommandInput {
    readonly requestedBy: RequestedBy;
}

/**
 * Base for use cases that **mutate state** (writes), following CQS.
 *
 * - `Input extends CommandInput` ensures every mutation records who triggered it.
 * - `Output extends Result<unknown, unknown>` ensures business errors are
 *   explicit values, never thrown exceptions.
 *
 * The Command/Query distinction is semantic: the type declares the intent
 * before any implementation exists, guiding code review and API contracts.
 */
@version("1.0")
abstract class Command<
    Input extends CommandInput,
    Output extends Result<unknown, unknown> = Result<void, never>,
> extends UseCase<Input, Output> {}

export type { CommandInput };
export { Command };
