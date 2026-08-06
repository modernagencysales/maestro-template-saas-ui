import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createContractsCliHandler } from "./contracts";

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true });
});

const fixture = () => {
  const root = mkdtempSync(join(tmpdir(), "maestro-contracts-"));
  roots.push(root);
  return root;
};

describe("contracts CLI", () => {
  it("adds one draft Feature without pretending its steps pass", async () => {
    const root = fixture();
    const result = await createContractsCliHandler().run(
      ["contracts", "add", "onboard-customer"],
      root,
    );

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("features/onboard-customer.feature");
    expect(
      readFileSync(join(root, "features/onboard-customer.feature"), "utf8"),
    ).toBe(`@wip
Feature: Onboard customer
  Describe the promised outcome in business language.

  @cross_surface
  Scenario: Complete onboard customer
    Given the product is ready
    When the user completes onboard customer
    Then the promised outcome is observable
`);
  });

  it("does not overwrite an existing contract", async () => {
    const root = fixture();
    const handler = createContractsCliHandler();
    await handler.run(["contracts", "add", "billing"], root);

    const result = await handler.run(["contracts", "add", "billing"], root);

    expect(result).toMatchObject({ exitCode: 1 });
    expect(result.stderr).toContain("already exists");
  });

  it("checks syntax and Cucumber bindings through the existing script", async () => {
    const calls: { readonly args: readonly string[]; readonly cwd: string }[] =
      [];
    const handler = createContractsCliHandler((args, cwd) => {
      calls.push({ args, cwd });
      return { exitCode: 0, stdout: "checked\n", stderr: "" };
    });

    const result = await handler.run(["contracts", "check"], "/customer");

    expect(result).toMatchObject({ exitCode: 0, stdout: "checked\n" });
    expect(calls).toEqual([
      { args: ["--silent", "acceptance:check"], cwd: "/customer" },
    ]);
  });

  it("runs all Features, one named Feature, or all required contracts", async () => {
    const recorded: string[][] = [];
    const handler = createContractsCliHandler((args) => {
      recorded.push([...args]);
      return { exitCode: 0, stdout: "", stderr: "" };
    });

    await handler.run(["contracts", "test"], "/customer");
    await handler.run(["contracts", "test", "onboard-customer"], "/customer");
    await handler.run(["contracts", "test", "--required"], "/customer");

    expect(recorded).toEqual([
      ["--silent", "acceptance:cucumber"],
      ["--silent", "acceptance:cucumber", "features/onboard-customer.feature"],
      ["--silent", "acceptance:features", "--required"],
      ["--silent", "acceptance:cucumber", "--tags", "@required"],
    ]);
  });

  it("does not start required contracts when structural admission fails", async () => {
    const recorded: string[][] = [];
    const handler = createContractsCliHandler((args) => {
      recorded.push([...args]);
      return {
        exitCode: 1,
        stdout: "",
        stderr:
          "required contract selection must include at least one scenario\n",
      };
    });

    const result = await handler.run(
      ["contracts", "test", "--required"],
      "/customer",
    );

    expect(result).toMatchObject({ exitCode: 1 });
    expect(recorded).toEqual([
      ["--silent", "acceptance:features", "--required"],
    ]);
  });
});
