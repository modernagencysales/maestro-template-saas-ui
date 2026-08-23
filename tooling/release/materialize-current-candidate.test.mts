import { execFileSync } from "node:child_process";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  assertCurrentCandidateSource,
  initializeStandaloneCandidateRepository,
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
  it("keeps successful customer web builds out of repository state", () => {
    expect(readFileSync(".gitignore", "utf8")).toContain("apps/*/.output/");
  });

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
    expect(
      parseCandidateArguments([
        "--",
        "--target",
        "/tmp/maestro-brain-candidate",
        "--name",
        "Maestro Brain",
        "--outcome",
        "Operate the agency",
      ]),
    ).toMatchObject({ name: "Maestro Brain" });
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

  it("initializes the materialized customer as a clean standalone main repository", () => {
    const targetRoot = temporaryRoot();
    writeFileSync(join(targetRoot, "template-instance.json"), "{}\n");

    const commit = initializeStandaloneCandidateRepository(targetRoot);

    expect(gitText(targetRoot, ["branch", "--show-current"])).toBe("main");
    expect(gitText(targetRoot, ["status", "--porcelain"])).toBe("");
    expect(gitText(targetRoot, ["rev-parse", "HEAD"])).toBe(commit);
    expect(gitText(targetRoot, ["log", "-1", "--pretty=%s"])).toBe(
      "chore: materialize current customer candidate",
    );
  });
});

const gitText = (root: string, args: readonly string[]): string =>
  execFileSync("git", ["-C", root, ...args], { encoding: "utf8" }).trim();
