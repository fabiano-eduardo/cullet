import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { resolveDoctorProjectRoot } from "../../cli/commands/doctor.js";

describe("resolveDoctorProjectRoot", () => {
  it("uses the current cwd when no override is provided", () => {
    expect(resolveDoctorProjectRoot("/workspace/project")).toBe(
      "/workspace/project",
    );
  });

  it("resolves relative overrides from the current cwd", () => {
    expect(resolveDoctorProjectRoot("/workspace/project", "apps/web")).toBe(
      join("/workspace/project", "apps/web"),
    );
  });

  it("keeps POSIX absolute overrides unchanged", () => {
    expect(
      resolveDoctorProjectRoot("/workspace/project", "/tmp/consumer"),
    ).toBe("/tmp/consumer");
  });

  it("keeps Windows absolute overrides unchanged", () => {
    expect(
      resolveDoctorProjectRoot("/workspace/project", "C:\\temp\\consumer"),
    ).toBe("C:\\temp\\consumer");
  });
});
