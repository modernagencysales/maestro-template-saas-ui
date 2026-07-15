import { describe, expect, it } from "vitest";
import {
  commandsForProfiles,
  formatCommandForFiles,
  focusedGateCommand,
  lintCommandForFiles,
} from "../src/gates.js";

describe("brain lane gate profiles", () => {
  it("deduplicates package gates", () => {
    const commands = commandsForProfiles(["convex", "convex"]);
    expect(commands).toHaveLength(2);
    expect(commands[0]).toEqual({
      program: "pnpm",
      args: ["--dir", "packages/convex", "typecheck"],
    });
  });

  it("routes tests through the focused host slot", () => {
    const commands = commandsForProfiles(["web"]);
    expect(commands[1]).toEqual({
      program: "host-test-slot",
      args: ["--class", "focused", "pnpm", "--dir", "apps/web", "test"],
    });
  });

  it("does not invent local gates for external receipts", () => {
    expect(commandsForProfiles(["external"])).toEqual([]);
  });

  it("keeps eval and generator package gates independent", () => {
    expect(
      commandsForProfiles(["evals"]).map((command) => command.args),
    ).toEqual([
      ["--dir", "tooling/evals", "typecheck"],
      ["--class", "focused", "pnpm", "--dir", "tooling/evals", "test"],
    ]);
    expect(
      commandsForProfiles(["generators"]).map((command) => command.args),
    ).toEqual([
      ["--dir", "tooling/generators", "typecheck"],
      ["--class", "focused", "pnpm", "--dir", "tooling/generators", "test"],
    ]);
    expect(
      commandsForProfiles(["tooling"]).map((command) => command.args),
    ).toEqual([]);
  });

  it("runs repository config drift for release-profile lanes", () => {
    expect(commandsForProfiles(["release"])).toEqual([
      {
        program: "pnpm",
        args: ["--dir", "tooling/release", "typecheck"],
      },
      {
        program: "host-test-slot",
        args: [
          "--class",
          "focused",
          "pnpm",
          "--dir",
          "tooling/release",
          "test",
        ],
      },
      { program: "pnpm", args: ["check:config-drift"] },
    ]);
  });

  it("lints changed source without passing docs or env files", () => {
    expect(
      lintCommandForFiles([
        "apps/web/src/example.tsx",
        "apps/web/src/example.tsx",
        "docs/example.md",
        ".env.example",
      ]),
    ).toEqual({
      program: "pnpm",
      args: ["exec", "eslint", "apps/web/src/example.tsx"],
    });
    expect(lintCommandForFiles(["docs/example.md"])).toBeUndefined();
  });

  it("formats supported files while ignoring unknown changed files", () => {
    expect(
      formatCommandForFiles([
        "docs/example.md",
        ".buildkite/scripts/release.sh",
        ".env.example",
        "docs/example.md",
      ]),
    ).toEqual({
      program: "pnpm",
      args: [
        "exec",
        "prettier",
        "--check",
        "--ignore-unknown",
        "docs/example.md",
        ".buildkite/scripts/release.sh",
        ".env.example",
      ],
    });
    expect(formatCommandForFiles([])).toBeUndefined();
  });

  it("parses narrow recorded gates without a shell", () => {
    expect(
      focusedGateCommand(
        "rtk host-test-slot --class focused pnpm --dir packages/search test",
      ),
    ).toEqual({
      program: "host-test-slot",
      args: ["--class", "focused", "pnpm", "--dir", "packages/search", "test"],
    });
  });

  it("rejects broad or shell-bearing recorded gates", () => {
    expect(() => focusedGateCommand("rtk pnpm verify")).toThrow(/broad/);
    expect(() => focusedGateCommand("rtk pnpm test")).toThrow(/broad/);
    expect(() => focusedGateCommand("pnpm --dir packages/search test")).toThrow(
      /start with/,
    );
    expect(() =>
      focusedGateCommand("rtk pnpm --dir packages/search test && rm -rf /"),
    ).toThrow(/shell syntax/);
  });
});
