import { UseCase } from "../use-case.js";
import { version } from "../../versioning/version.js";
import type { TraceAttributeValue } from "../ports/tracer.port.js";
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
> extends UseCase<Input, Output> {
    /**
     * Surfaces the actor's *kind* (`"user"` / `"system"`) on the span and
     * metrics so a write can be sliced by origin. Only the low-cardinality
     * `kind` is emitted — never the raw id, which would blow up label
     * cardinality and could leak a user identifier into metrics.
     */
    protected override spanAttributes(
        input: Input,
    ): Readonly<Record<string, TraceAttributeValue>> {
        return { "requested_by.kind": input.requestedBy.kind };
    }
}

export type { CommandInput };
export { Command };
