import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const sourceRoot = fileURLToPath(new URL("../", import.meta.url));
const read = (path: string) => readFileSync(`${sourceRoot}/${path}`, "utf8");

describe("workspace route states", () => {
  it("starts without shipped sample records", () => {
    expect(existsSync(`${sourceRoot}/sample/templateData.ts`)).toBe(false);
  });

  it("keeps loading, empty, read, edit, success, failure, and not-found states explicit", () => {
    const source = read("saas-ui/patterns/page-states.tsx");

    for (const state of [
      "loading",
      "empty",
      "read",
      "edit",
      "success",
      "failure",
      "not-found",
    ]) {
      expect(source).toContain(`"${state}"`);
    }
    expect(source).toContain('role="status"');
    expect(source).toContain('isFailure ? "alert" : "status"');
  });

  it("uses dedicated settings and integration compositions", () => {
    expect(read("routes/_workspace.settings.tsx")).toContain(
      "WorkspaceSettingsRoute",
    );
    expect(read("routes/_workspace.integrations.tsx")).toContain(
      "WorkspaceIntegrationsRoute",
    );
  });
});
