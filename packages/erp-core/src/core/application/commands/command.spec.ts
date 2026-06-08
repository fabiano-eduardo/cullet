import { describe, expect, it } from "vitest";

import { Result } from "../../result/result";
import { UseCase } from "../use-case";

import { Command } from "./command";
import { RequestedBy } from "./requested-by";

class SaveEntityCommand extends Command<
    { id: string; requestedBy: RequestedBy },
    Result<void, never>
> {
    protected execute(_input: {
        id: string;
        requestedBy: RequestedBy;
    }): Result<void, never> {
        // side effects would happen here (persistence, events, etc.)
        return Result.ok(undefined);
    }
}

class ComputeAndReturnCommand extends Command<
    { value: number; requestedBy: RequestedBy },
    Result<number, never>
> {
    protected execute(input: {
        value: number;
        requestedBy: RequestedBy;
    }): Result<number, never> {
        return Result.ok(input.value + 1);
    }
}

describe("Command", () => {
    it("is a subclass of UseCase", () => {
        const command = new SaveEntityCommand();

        expect(command).toBeInstanceOf(UseCase);
    });

    it("executes via run() and returns the output of execute()", async () => {
        const command = new ComputeAndReturnCommand();
        const result = await command.run({
            value: 9,
            requestedBy: RequestedBy.fromSystem("system:test-job"),
        });

        expect(result.isOk()).toBe(true);
        expect(result.getOrNull()).toBe(10);
    });

    it("inherits CONTRACT_VERSION from UseCase", () => {
        expect(Command.CONTRACT_VERSION).toBe("1.0");
    });

    it("inherits the contractVersion getter on the instance", () => {
        const command = new SaveEntityCommand();

        expect(command.contractVersion).toBe("1.0");
    });
});
