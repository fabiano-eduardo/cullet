import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  disableTelemetry,
  emitTelemetryIfEnabled,
  enableTelemetry,
  resolveTelemetryConfigPath,
  getTelemetryStatus,
  resolveTelemetryLogPath,
  runCommandWithTelemetry,
} from "../../cli/utils/telemetry.js";

let homeDir: string;

async function readLoggedEvents(env: NodeJS.ProcessEnv): Promise<unknown[]> {
  const contents = await readFile(resolveTelemetryLogPath(env), "utf8");
  return contents
    .trim()
    .split("\n")
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as unknown);
}

function makeEnv(): NodeJS.ProcessEnv {
  return {
    ...process.env,
    HOME: homeDir,
    CULLET_CONFIG_HOME: join(homeDir, "config"),
    CULLET_STATE_HOME: join(homeDir, "state"),
  };
}

beforeEach(async () => {
  homeDir = await mkdtemp(join(tmpdir(), "cullet-telemetry-"));
});

afterEach(async () => {
  vi.restoreAllMocks();
  await rm(homeDir, { recursive: true, force: true });
});

describe("telemetry config", () => {
  it("enables and disables telemetry using the user config file", async () => {
    const env = makeEnv();

    const enabled = await enableTelemetry({
      env,
      endpoint: "https://telemetry.example.dev/events",
    });
    expect(enabled.enabled).toBe(true);
    expect(enabled.endpoint).toBe("https://telemetry.example.dev/events");
    expect(enabled.anonymousId).toBeDefined();

    await expect(getTelemetryStatus({ env })).resolves.toMatchObject({
      enabled: true,
      endpoint: "https://telemetry.example.dev/events",
    });

    const disabled = await disableTelemetry({ env });
    expect(disabled.enabled).toBe(false);
    expect(disabled.endpoint).toBe("https://telemetry.example.dev/events");
  });

  it("rejects endpoints that are not HTTPS", async () => {
    const env = makeEnv();

    await expect(
      enableTelemetry({
        env,
        endpoint: "http://127.0.0.1:4318/events",
      })
    ).rejects.toThrow("HTTPS");
  });

  it("creates the telemetry config file with owner-only permissions", async () => {
    const env = makeEnv();

    await enableTelemetry({ env });

    const configMode =
      (await stat(resolveTelemetryConfigPath(env))).mode & 0o777;

    expect(configMode).toBe(0o600);
  });
});

describe("emitTelemetryIfEnabled", () => {
  it("writes a local event, exports it to a configured HTTPS endpoint, and consumes the response", async () => {
    const env = makeEnv();
    const receivedBodies: string[] = [];
    let inspectedOk = false;
    let consumedBody = false;
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (_input, init) => {
        if (typeof init?.body === "string") {
          receivedBodies.push(init.body);
        }

        return {
          get ok() {
            inspectedOk = true;
            return true;
          },
          status: 204,
          text: vi.fn().mockImplementation(async () => {
            consumedBody = true;
            return "";
          }),
        } as Response;
      });

    await enableTelemetry({
      env,
      endpoint: "https://telemetry.example.dev/events",
    });

    await expect(
      emitTelemetryIfEnabled(
        import.meta.url,
        {
          command: "fc",
          success: true,
          durationMs: 42,
          properties: {
            kit: "erp-core",
            resolvedVersion: "1.0.0",
          },
        },
        { env }
      )
    ).resolves.toBe(true);

    const logContents = await readFile(resolveTelemetryLogPath(env), "utf8");
    const loggedEvent = JSON.parse(logContents.trim()) as {
      command: string;
      properties: Record<string, string>;
    };
    expect(loggedEvent.command).toBe("fc");
    expect(loggedEvent.properties.kit).toBe("erp-core");

    expect(fetchSpy).toHaveBeenCalledWith(
      "https://telemetry.example.dev/events",
      expect.objectContaining({
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
      })
    );
    expect(inspectedOk).toBe(true);
    expect(consumedBody).toBe(true);
    expect(receivedBodies).toHaveLength(1);
    const postedEvent = JSON.parse(receivedBodies[0]) as {
      command: string;
      properties: Record<string, string>;
    };
    expect(postedEvent.command).toBe("fc");
    expect(postedEvent.properties.resolvedVersion).toBe("1.0.0");
  });

  it("ignores invalid remote endpoints loaded from the config file", async () => {
    const env = makeEnv();
    const configPath = resolveTelemetryConfigPath(env);
    await mkdir(dirname(configPath), { recursive: true });
    await writeFile(
      configPath,
      `${JSON.stringify(
        {
          enabled: true,
          endpoint: "http://127.0.0.1:4318/events",
        },
        null,
        2
      )}\n`,
      "utf8"
    );

    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue({ ok: true, status: 204 } as Response);

    await expect(
      emitTelemetryIfEnabled(
        import.meta.url,
        {
          command: "info",
          success: true,
          durationMs: 5,
        },
        { env }
      )
    ).resolves.toBe(true);

    expect(fetchSpy).not.toHaveBeenCalled();
    await expect(getTelemetryStatus({ env })).resolves.toMatchObject({
      enabled: true,
      endpoint: undefined,
    });
  });

  it("creates the local event log with owner-only permissions", async () => {
    const env = makeEnv();

    await enableTelemetry({ env });
    await emitTelemetryIfEnabled(
      import.meta.url,
      {
        command: "info",
        success: true,
        durationMs: 1,
      },
      { env }
    );

    const logMode = (await stat(resolveTelemetryLogPath(env))).mode & 0o777;

    expect(logMode).toBe(0o600);
  });

  it("rethrows unexpected telemetry configuration resolution failures", async () => {
    const env = {
      ...process.env,
      HOME: undefined,
      CULLET_CONFIG_HOME: undefined,
      XDG_CONFIG_HOME: undefined,
    };

    await expect(
      emitTelemetryIfEnabled(
        import.meta.url,
        {
          command: "info",
          success: true,
          durationMs: 1,
        },
        { env }
      )
    ).rejects.toThrow("HOME nao esta definido");
  });

  it("rethrows unexpected CLI version resolution failures", async () => {
    vi.resetModules();
    const telemetry = await import("../../cli/utils/telemetry.js");
    const env = makeEnv();

    await telemetry.enableTelemetry({ env });

    await expect(
      telemetry.emitTelemetryIfEnabled(
        "not-a-valid-url",
        {
          command: "info",
          success: true,
          durationMs: 1,
        },
        { env }
      )
    ).rejects.toThrow();
  });

  it("keeps the local event when the remote endpoint rejects the payload with 400", async () => {
    const env = makeEnv();
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      status: 400,
      text: vi.fn().mockResolvedValue('{"error":"payload rejected"}'),
    } as Response);

    await enableTelemetry({
      env,
      endpoint: "https://telemetry.example.dev/events",
    });

    await expect(
      emitTelemetryIfEnabled(
        import.meta.url,
        {
          command: "info",
          success: true,
          durationMs: 7,
        },
        { env }
      )
    ).resolves.toBe(true);

    expect(fetchSpy).toHaveBeenCalledOnce();
    await expect(readLoggedEvents(env)).resolves.toHaveLength(1);
  });

  it("logs non-ok remote responses to stderr when verbose mode is enabled", async () => {
    const env = { ...makeEnv(), CULLET_VERBOSE: "1" };
    const stderrSpy = vi
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);
    let consumedBody = false;

    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      status: 400,
      text: vi.fn().mockImplementation(async () => {
        consumedBody = true;
        return '{"error":"payload rejected"}';
      }),
    } as Response);

    await enableTelemetry({
      env,
      endpoint: "https://telemetry.example.dev/events",
    });

    await expect(
      emitTelemetryIfEnabled(
        import.meta.url,
        {
          command: "info",
          success: true,
          durationMs: 7,
        },
        { env }
      )
    ).resolves.toBe(true);

    expect(consumedBody).toBe(true);
    expect(
      stderrSpy.mock.calls.map(([value]) => String(value)).join("")
    ).toContain("status 400");
    expect(
      stderrSpy.mock.calls.map(([value]) => String(value)).join("")
    ).toContain("payload rejected");
    await expect(readLoggedEvents(env)).resolves.toHaveLength(1);
  });

  it("keeps the local event when the remote endpoint returns 5xx", async () => {
    const env = makeEnv();
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue({ ok: false, status: 503 } as Response);

    await enableTelemetry({
      env,
      endpoint: "https://telemetry.example.dev/events",
    });

    await expect(
      emitTelemetryIfEnabled(
        import.meta.url,
        {
          command: "list",
          success: true,
          durationMs: 3,
        },
        { env }
      )
    ).resolves.toBe(true);

    expect(fetchSpy).toHaveBeenCalledOnce();
    await expect(readLoggedEvents(env)).resolves.toHaveLength(1);
  });

  it("logs remote transport failures to stderr when verbose mode is enabled", async () => {
    const env = { ...makeEnv(), CULLET_VERBOSE: "1" };
    const stderrSpy = vi
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);

    vi.spyOn(globalThis, "fetch").mockRejectedValue(
      new Error("socket hang up")
    );

    await enableTelemetry({
      env,
      endpoint: "https://telemetry.example.dev/events",
    });

    await expect(
      emitTelemetryIfEnabled(
        import.meta.url,
        {
          command: "doctor",
          success: true,
          durationMs: 11,
        },
        { env }
      )
    ).resolves.toBe(true);

    expect(
      stderrSpy.mock.calls.map(([value]) => String(value)).join("")
    ).toContain("socket hang up");
    await expect(readLoggedEvents(env)).resolves.toHaveLength(1);
  });

  it("aborts the remote export after 2000ms and still keeps the local event", async () => {
    const env = makeEnv();
    vi.useFakeTimers();

    try {
      let aborted = false;
      let notifyFetchStarted: (() => void) | undefined;
      const fetchStarted = new Promise<void>((resolve) => {
        notifyFetchStarted = resolve;
      });
      const fetchSpy = vi
        .spyOn(globalThis, "fetch")
        .mockImplementation((_input, init) => {
          notifyFetchStarted?.();
          return new Promise((_resolve, reject) => {
            init?.signal?.addEventListener(
              "abort",
              () => {
                aborted = true;
                reject(new Error("aborted"));
              },
              { once: true }
            );
          });
        });

      await enableTelemetry({
        env,
        endpoint: "https://telemetry.example.dev/events",
      });

      const result = emitTelemetryIfEnabled(
        import.meta.url,
        {
          command: "doctor",
          success: true,
          durationMs: 11,
        },
        { env }
      );

      await fetchStarted;

      await vi.advanceTimersByTimeAsync(1999);
      expect(aborted).toBe(false);

      await vi.advanceTimersByTimeAsync(1);

      await expect(result).resolves.toBe(true);
      expect(aborted).toBe(true);
      expect(fetchSpy).toHaveBeenCalledOnce();
      await expect(readLoggedEvents(env)).resolves.toHaveLength(1);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("runCommandWithTelemetry", () => {
  it("records success and failure events with command properties", async () => {
    const env = makeEnv();
    await enableTelemetry({ env });

    await runCommandWithTelemetry({
      fromMetaUrl: import.meta.url,
      command: "info",
      env,
      async handler(tracker) {
        tracker.set("kit", "erp-core");
        tracker.set("resolvedVersion", "1.0.0");
      },
    });

    await expect(
      runCommandWithTelemetry({
        fromMetaUrl: import.meta.url,
        command: "migrate",
        env,
        async handler(tracker) {
          tracker.set("kit", "erp-core");
          throw new TypeError("boom");
        },
      })
    ).rejects.toThrow("boom");

    const lines = (await readFile(resolveTelemetryLogPath(env), "utf8"))
      .trim()
      .split("\n")
      .map(
        (line) =>
          JSON.parse(line) as {
            command: string;
            success: boolean;
            properties: Record<string, string>;
          }
      );

    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatchObject({
      command: "info",
      success: true,
      properties: {
        kit: "erp-core",
        resolvedVersion: "1.0.0",
      },
    });
    expect(lines[1]).toMatchObject({
      command: "migrate",
      success: false,
      properties: {
        kit: "erp-core",
        failureKind: "TypeError",
      },
    });
  });
});
