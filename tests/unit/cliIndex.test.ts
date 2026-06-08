import { afterEach, describe, expect, it, vi } from "vitest";

const originalArgv = [...process.argv];
const originalExitCode = process.exitCode;

function makeFakeCommander(options: {
    parseAsync: (argv: string[]) => Promise<void>;
    addedCommands: unknown[];
    versionCalls: string[];
}) {
    return class FakeCommand {
        name(): this {
            return this;
        }

        description(): this {
            return this;
        }

        version(value: string): this {
            options.versionCalls.push(value);
            return this;
        }

        addCommand(command: unknown): this {
            options.addedCommands.push(command);
            return this;
        }

        async parseAsync(argv: string[]): Promise<void> {
            await options.parseAsync(argv);
        }
    };
}

async function importCliIndex(tag: string): Promise<void> {
    const moduleUrl = new URL(
        `../../packages/cli/src/cli/index.ts?${tag}`,
        import.meta.url,
    );
    await import(/* @vite-ignore */ moduleUrl.href);
    await new Promise((resolve) => setImmediate(resolve));
}

afterEach(() => {
    process.argv = [...originalArgv];
    process.exitCode = originalExitCode;
    vi.restoreAllMocks();
    vi.resetModules();
});

describe("cli index", () => {
    it("wires the command set and parses argv with the package version", async () => {
        const addedCommands: unknown[] = [];
        const versionCalls: string[] = [];
        const parseAsync = vi.fn().mockResolvedValue(undefined);
        const commands = {
            list: { name: "list" },
            info: { name: "info" },
            fc: { name: "fc" },
            migrate: { name: "migrate" },
            telemetry: { name: "telemetry" },
            doctor: { name: "doctor" },
        };

        vi.doMock("commander", () => ({
            Command: makeFakeCommander({
                parseAsync,
                addedCommands,
                versionCalls,
            }),
        }));
        vi.doMock("node:fs/promises", () => ({
            readFile: vi.fn().mockResolvedValue('{"version":"0.2.0"}'),
        }));
        vi.doMock("../../packages/cli/src/cli/utils/resolve.js", () => ({
            findCulletPackageRoot: vi.fn().mockReturnValue("/repo"),
        }));
        vi.doMock("../../packages/cli/src/cli/commands/list.js", () => ({
            createListCommand: vi.fn().mockReturnValue(commands.list),
        }));
        vi.doMock("../../packages/cli/src/cli/commands/info.js", () => ({
            createInfoCommand: vi.fn().mockReturnValue(commands.info),
        }));
        vi.doMock(
            "../../packages/cli/src/cli/commands/full-control.js",
            () => ({
                createFullControlCommand: vi.fn().mockReturnValue(commands.fc),
            }),
        );
        vi.doMock("../../packages/cli/src/cli/commands/migrate.js", () => ({
            createMigrateCommand: vi.fn().mockReturnValue(commands.migrate),
        }));
        vi.doMock("../../packages/cli/src/cli/commands/telemetry.js", () => ({
            createTelemetryCommand: vi.fn().mockReturnValue(commands.telemetry),
        }));
        vi.doMock("../../packages/cli/src/cli/commands/doctor.js", () => ({
            createDoctorCommand: vi.fn().mockReturnValue(commands.doctor),
        }));

        process.argv = ["node", "cullet", "list"];

        await importCliIndex("success");

        expect(versionCalls).toEqual(["0.2.0"]);
        expect(addedCommands).toEqual([
            commands.list,
            commands.info,
            commands.fc,
            commands.migrate,
            commands.telemetry,
            commands.doctor,
        ]);
        expect(parseAsync).toHaveBeenCalledWith(["node", "cullet", "list"]);
    });

    it("reports parse failures through stderr and exitCode", async () => {
        const errorSpy = vi
            .spyOn(console, "error")
            .mockImplementation(() => {});

        vi.doMock("commander", () => ({
            Command: makeFakeCommander({
                parseAsync: vi.fn().mockRejectedValue(new Error("boom")),
                addedCommands: [],
                versionCalls: [],
            }),
        }));
        vi.doMock("node:fs/promises", () => ({
            readFile: vi.fn().mockResolvedValue('{"version":"0.2.0"}'),
        }));
        vi.doMock("../../packages/cli/src/cli/utils/resolve.js", () => ({
            findCulletPackageRoot: vi.fn().mockReturnValue("/repo"),
        }));
        vi.doMock("../../packages/cli/src/cli/commands/list.js", () => ({
            createListCommand: vi.fn().mockReturnValue({}),
        }));
        vi.doMock("../../packages/cli/src/cli/commands/info.js", () => ({
            createInfoCommand: vi.fn().mockReturnValue({}),
        }));
        vi.doMock(
            "../../packages/cli/src/cli/commands/full-control.js",
            () => ({
                createFullControlCommand: vi.fn().mockReturnValue({}),
            }),
        );
        vi.doMock("../../packages/cli/src/cli/commands/migrate.js", () => ({
            createMigrateCommand: vi.fn().mockReturnValue({}),
        }));
        vi.doMock("../../packages/cli/src/cli/commands/telemetry.js", () => ({
            createTelemetryCommand: vi.fn().mockReturnValue({}),
        }));
        vi.doMock("../../packages/cli/src/cli/commands/doctor.js", () => ({
            createDoctorCommand: vi.fn().mockReturnValue({}),
        }));

        process.argv = ["node", "cullet", "list"];

        await importCliIndex("parse-error");

        expect(process.exitCode).toBe(1);
        expect(errorSpy).toHaveBeenCalledWith(
            expect.stringContaining("Erro: boom"),
        );
    });

    it("reports an invalid package version before parsing commands", async () => {
        const errorSpy = vi
            .spyOn(console, "error")
            .mockImplementation(() => {});

        vi.doMock("commander", () => ({
            Command: makeFakeCommander({
                parseAsync: vi.fn().mockResolvedValue(undefined),
                addedCommands: [],
                versionCalls: [],
            }),
        }));
        vi.doMock("node:fs/promises", () => ({
            readFile: vi.fn().mockResolvedValue("{}"),
        }));
        vi.doMock("../../packages/cli/src/cli/utils/resolve.js", () => ({
            findCulletPackageRoot: vi.fn().mockReturnValue("/repo"),
        }));
        vi.doMock("../../packages/cli/src/cli/commands/list.js", () => ({
            createListCommand: vi.fn().mockReturnValue({}),
        }));
        vi.doMock("../../packages/cli/src/cli/commands/info.js", () => ({
            createInfoCommand: vi.fn().mockReturnValue({}),
        }));
        vi.doMock(
            "../../packages/cli/src/cli/commands/full-control.js",
            () => ({
                createFullControlCommand: vi.fn().mockReturnValue({}),
            }),
        );
        vi.doMock("../../packages/cli/src/cli/commands/migrate.js", () => ({
            createMigrateCommand: vi.fn().mockReturnValue({}),
        }));
        vi.doMock("../../packages/cli/src/cli/commands/telemetry.js", () => ({
            createTelemetryCommand: vi.fn().mockReturnValue({}),
        }));
        vi.doMock("../../packages/cli/src/cli/commands/doctor.js", () => ({
            createDoctorCommand: vi.fn().mockReturnValue({}),
        }));

        process.argv = ["node", "cullet", "list"];

        await importCliIndex("invalid-version");

        expect(process.exitCode).toBe(1);
        expect(errorSpy).toHaveBeenCalledWith(
            expect.stringContaining(
                "package.json do cullet nao contem um campo version valido",
            ),
        );
    });
});
