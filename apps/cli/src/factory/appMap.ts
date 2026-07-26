import {
  executeAppMapImpact,
  executeAppMapMap,
} from "@maestro-template/app-map-tooling/surface";
import type { CliResult } from "../types";
import type { FactoryCliHandler } from "./router";

const result = (
  value: Awaited<ReturnType<typeof executeAppMapMap>>,
  json: boolean,
): CliResult =>
  value.ok
    ? {
        exitCode: 0,
        stdout: json ? `${JSON.stringify(value.data, null, 2)}\n` : value.human,
        stderr: "",
      }
    : { exitCode: 1, stdout: "", stderr: value.human };

const options = (argv: readonly string[]) => {
  const values = new Map<string, string>();
  let json = false;
  let valid = true;
  for (let index = 1; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--json") {
      if (json) valid = false;
      json = true;
      continue;
    }
    if (
      ["--revision", "--base", "--trusted-ci-base", "--head"].includes(
        token ?? "",
      )
    ) {
      const value = argv[index + 1];
      if (!token || !value || value.startsWith("--") || values.has(token))
        valid = false;
      else {
        values.set(token, value);
        index += 1;
      }
      continue;
    }
    valid = false;
  }
  return { valid, json, values };
};

export const createAppMapCliHandlers = (): readonly FactoryCliHandler[] => [
  {
    command: "map",
    run: async (argv, cwd) => {
      const parsed = options(argv);
      if (
        !parsed.valid ||
        [...parsed.values.keys()].some((key) => key !== "--revision")
      )
        return {
          exitCode: 1,
          stdout: "",
          stderr: "Usage: map [--revision SHA] [--json]\n",
        };
      const revision = parsed.values.get("--revision");
      return result(
        await executeAppMapMap({
          repoRoot: cwd,
          ...(revision === undefined ? {} : { revision }),
        }),
        parsed.json,
      );
    },
  },
  {
    command: "impact",
    run: async (argv, cwd) => {
      const parsed = options(argv);
      const base = parsed.values.get("--base");
      const trusted = parsed.values.get("--trusted-ci-base");
      if (
        !parsed.valid ||
        (base === undefined) === (trusted === undefined) ||
        parsed.values.has("--revision")
      )
        return {
          exitCode: 1,
          stdout: "",
          stderr:
            "Usage: impact (--base SHA | --trusted-ci-base SHA) [--head SHA] [--json]\n",
        };
      const headRevision = parsed.values.get("--head");
      return result(
        await executeAppMapImpact({
          repoRoot: cwd,
          ...(base === undefined ? {} : { explicitBaseRevision: base }),
          ...(trusted === undefined ? {} : { trustedCiBaseRevision: trusted }),
          ...(headRevision === undefined ? {} : { headRevision }),
        }),
        parsed.json,
      );
    },
  },
];
