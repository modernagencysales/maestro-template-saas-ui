import {
  previewAdoptionWorkPackage,
  validateAdoptionAuthority,
  type AdoptionAuthorityInput,
  type AdoptionWorkPackage,
} from "@maestro-template/agent-pack";
import { isAbsolute, relative, resolve } from "node:path";
import { cliFailure, cliSuccess, formatJsonOutput } from "../result";
import type { CliResult } from "../types";
import type { FactoryCliHandler } from "./router";

export const ADOPT_HELP =
  "maestro adopt preflight --source <path> --target <path> --authority <json> | maestro adopt work-package --source <path> --target <path> --input <json> --out <path> [--json] (dry-run only; --write and cutover are unsupported)";

type ReadFile = (root: string, path: string) => Promise<string>;
type PacketReader = (path: string) => Promise<string>;

const within = (root: string, path: string): string | null => {
  const absolute = resolve(root, path);
  const fromRoot = relative(root, absolute);
  return fromRoot === "" ||
    (!fromRoot.startsWith("..") && !isAbsolute(fromRoot))
    ? absolute
    : null;
};

const parse = (argv: readonly string[]) => {
  const subcommand = argv[1];
  const values = new Map<string, string>();
  let jsonSeen = false;
  let valid = subcommand === "preflight" || subcommand === "work-package";
  for (let index = 2; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--json") {
      if (jsonSeen) valid = false;
      jsonSeen = true;
      continue;
    }
    if (token === "--write" || token === "--cutover") {
      valid = false;
      continue;
    }
    const value = argv[index + 1];
    if (
      token === undefined ||
      !token.startsWith("--") ||
      value === undefined ||
      value.startsWith("--") ||
      values.has(token)
    ) {
      valid = false;
      continue;
    }
    values.set(token, value);
    index += 1;
  }
  return { subcommand, values, valid };
};

const invalid = (message: string): CliResult => ({
  exitCode: 2,
  stdout: "",
  stderr: `${message}\n${ADOPT_HELP}\n`,
});

const parseJson = async (
  readFile: PacketReader,
  path: string,
): Promise<unknown> => JSON.parse(await readFile(path)) as unknown;

export const createAdoptCliHandler = (dependencies: {
  readonly readFile: ReadFile;
}): FactoryCliHandler => ({
  command: "adopt",
  run: async (argv, cwd) => {
    if (argv.length === 2 && argv[1] === "--help")
      return cliSuccess(`${ADOPT_HELP}\n`);
    if (argv.includes("--write") || argv[1] === "cutover")
      return invalid(
        "Adoption mutation is unavailable: this command only validates and previews reviewed artifacts.",
      );
    const parsed = parse(argv);
    if (!parsed.valid) return invalid("Invalid adoption invocation.");
    const sourceArg = parsed.values.get("--source");
    const targetArg = parsed.values.get("--target");
    const packetArg = parsed.values.get(
      parsed.subcommand === "preflight" ? "--authority" : "--input",
    );
    const expected =
      parsed.subcommand === "preflight"
        ? ["--source", "--target", "--authority"]
        : ["--source", "--target", "--input", "--out"];
    if (
      sourceArg === undefined ||
      targetArg === undefined ||
      packetArg === undefined ||
      parsed.values.size !== expected.length ||
      expected.some((flag) => !parsed.values.has(flag))
    )
      return invalid("Adoption arguments are incomplete or unknown.");
    const packetPath = within(cwd, packetArg);
    if (packetPath === null)
      return invalid(
        "Adoption packet paths must stay inside the current repository.",
      );
    try {
      const source = resolve(cwd, sourceArg);
      const target = resolve(cwd, targetArg);
      const packet = await parseJson(
        (path) => dependencies.readFile(cwd, path),
        packetPath,
      );
      if (parsed.subcommand === "preflight") {
        const authority = packet as AdoptionAuthorityInput;
        if (
          authority.source?.requestedRoot !== source ||
          authority.target?.requestedRoot !== target
        )
          return invalid(
            "CLI source and target roots do not match the reviewed authority packet.",
          );
        const result = validateAdoptionAuthority(authority);
        return result.ok
          ? cliSuccess(formatJsonOutput(result))
          : cliFailure(formatJsonOutput(result));
      }
      const workPackage = packet as AdoptionWorkPackage;
      if (
        workPackage.roots?.source !== source ||
        workPackage.roots?.target !== target
      )
        return invalid(
          "CLI source and target roots do not match the reviewed work package.",
        );
      const preview = previewAdoptionWorkPackage(workPackage);
      const output = {
        ...preview,
        requestedOutput: parsed.values.get("--out"),
        writeSupported: false,
      };
      return preview.ok
        ? cliSuccess(formatJsonOutput(output))
        : cliFailure(formatJsonOutput(output));
    } catch {
      return invalid(
        "The adoption packet is missing, malformed, or unreadable.",
      );
    }
  },
});
