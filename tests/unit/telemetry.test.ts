import { createServer } from "node:http";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  disableTelemetry,
  emitTelemetryIfEnabled,
  enableTelemetry,
  getTelemetryStatus,
  resolveTelemetryLogPath,
  runCommandWithTelemetry,
} from "../../cli/utils/telemetry.js";

let homeDir: string;

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
  await rm(homeDir, { recursive: true, force: true });
});

describe("telemetry config", () => {
  it("enables and disables telemetry using the user config file", async () => {
    const env = makeEnv();

    const enabled = await enableTelemetry({
      env,
      endpoint: "http://127.0.0.1:4318/events",
    });
    expect(enabled.enabled).toBe(true);
    expect(enabled.endpoint).toBe("http://127.0.0.1:4318/events");
    expect(enabled.anonymousId).toBeDefined();

    await expect(getTelemetryStatus({ env })).resolves.toMatchObject({
      enabled: true,
      endpoint: "http://127.0.0.1:4318/events",
    });

    const disabled = await disableTelemetry({ env });
    expect(disabled.enabled).toBe(false);
    expect(disabled.endpoint).toBe("http://127.0.0.1:4318/events");
  });
});

describe("emitTelemetryIfEnabled", () => {
  it("writes a local event and exports it to the configured HTTP endpoint", async () => {
    const env = makeEnv();
    const receivedBodies: string[] = [];
    const server = createServer((request, response) => {
      const chunks: Buffer[] = [];
      request.on("data", (chunk) => {
        chunks.push(Buffer.from(chunk));
      });
      request.on("end", () => {
        receivedBodies.push(Buffer.concat(chunks).toString("utf8"));
        response.statusCode = 204;
        response.end();
      });
    });

    await new Promise<void>((resolvePromise) => {
      server.listen(0, "127.0.0.1", () => resolvePromise());
    });

    try {
      const address = server.address();
      if (address === null || typeof address === "string") {
        throw new Error("expected TCP server address");
      }

      await enableTelemetry({
        env,
        endpoint: `http://127.0.0.1:${address.port}/events`,
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
          { env },
        ),
      ).resolves.toBe(true);

      const logContents = await readFile(resolveTelemetryLogPath(env), "utf8");
      const loggedEvent = JSON.parse(logContents.trim()) as {
        command: string;
        properties: Record<string, string>;
      };
      expect(loggedEvent.command).toBe("fc");
      expect(loggedEvent.properties.kit).toBe("erp-core");

      expect(receivedBodies).toHaveLength(1);
      const postedEvent = JSON.parse(receivedBodies[0]) as {
        command: string;
        properties: Record<string, string>;
      };
      expect(postedEvent.command).toBe("fc");
      expect(postedEvent.properties.resolvedVersion).toBe("1.0.0");
    } finally {
      await new Promise<void>((resolvePromise, rejectPromise) => {
        server.close((error) => {
          if (error) {
            rejectPromise(error);
            return;
          }
          resolvePromise();
        });
      });
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
      }),
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
          },
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
