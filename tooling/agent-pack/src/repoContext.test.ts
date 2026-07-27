import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  RepositoryContextError,
  createRepositoryContext,
  resolveTargetPath,
} from "./repoContext.js";

describe("repository context", () => {
  it("uses one explicit absolute root for a canonical checkout", () => {
    const context = createRepositoryContext({ cwd: "/work/maestro" });

    expect(context).toEqual({
      schemaVersion: 1,
      workingDirectory: resolve("/work/maestro"),
      sourceRoot: resolve("/work/maestro"),
      templateRoot: resolve("/work/maestro"),
      targetRoot: resolve("/work/maestro"),
    });
  });

  it("resolves distinct source, template, and target roots from the cwd", () => {
    const context = createRepositoryContext({
      cwd: "/work/controller",
      sourceRoot: "source",
      templateRoot: "immutable-template",
      targetRoot: "../customer",
    });

    expect(context).toEqual({
      schemaVersion: 1,
      workingDirectory: resolve("/work/controller"),
      sourceRoot: resolve("/work/controller/source"),
      templateRoot: resolve("/work/controller/immutable-template"),
      targetRoot: resolve("/work/customer"),
    });
  });

  it("resolves only bounded relative paths inside the target root", () => {
    const context = createRepositoryContext({
      cwd: "/work/source",
      targetRoot: "/work/customer",
    });

    expect(resolveTargetPath(context, "apps/web/package.json")).toBe(
      resolve("/work/customer/apps/web/package.json"),
    );
    for (const path of ["", ".", "..", "../outside", "/etc/passwd"]) {
      expect(() => resolveTargetPath(context, path)).toThrow(
        RepositoryContextError,
      );
    }
  });

  it("provides a stable code for unsafe target paths", () => {
    const context = createRepositoryContext({ cwd: "/work/source" });

    try {
      resolveTargetPath(context, "../outside");
      throw new Error("expected unsafe path rejection");
    } catch (error) {
      expect(error).toMatchObject({
        name: "RepositoryContextError",
        code: "AGENT_PACK_TARGET_PATH_UNSAFE",
        message: "Target path must stay inside the target root: ../outside",
      });
    }
  });
});
