import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  assertCurrentCandidateSource,
  parseCandidateArguments,
} from "./materialize-current-candidate.mts";

const roots: string[] = [];
const temporaryRoot = (): string => {
  const root = mkdtempSync(join(tmpdir(), "maestro-current-candidate-test-"));
  roots.push(root);
  return root;
};

afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true });
});

describe("current source customer candidate", () => {
  it("requires explicit closed arguments and an absolute target", () => {
    expect(
      parseCandidateArguments([
        "--target",
        "/tmp/maestro-brain-candidate",
        "--name",
        "Maestro Brain",
        "--outcome",
        "Operate the agency",
      ]),
    ).toEqual({
      targetRoot: "/tmp/maestro-brain-candidate",
      name: "Maestro Brain",
      outcome: "Operate the agency",
    });
    expect(() => parseCandidateArguments(["--target", "relative"])).toThrow(
      "requires --name",
    );
    expect(() =>
      parseCandidateArguments([
        "--target",
        "relative",
        "--name",
        "Maestro Brain",
        "--outcome",
        "Operate the agency",
      ]),
    ).toThrow("must be an absolute path");
  });

  it("rejects a dirty factory and a target inside it", () => {
    const sourceRoot = temporaryRoot();
    mkdirSync(join(sourceRoot, "releases"));
    mkdirSync(join(sourceRoot, "apps/cli/src/factory"), { recursive: true });
    writeFileSync(
      join(sourceRoot, "apps/cli/src/factory/createComposition.ts"),
      "",
    );
    execFileSync("git", ["init", "-q", "-b", "main"], { cwd: sourceRoot });
    expect(() =>
      assertCurrentCandidateSource({
        sourceRoot,
        targetRoot: join(sourceRoot, "customer"),
      }),
    ).toThrow("clean source checkout");
  });
});
