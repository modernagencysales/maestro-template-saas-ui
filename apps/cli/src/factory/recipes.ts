import {
  AGENT_PACK_EXECUTION_CONTEXT_VERSION,
  createRepositoryContext,
  type AgentPackCommand,
  type AgentPackJsonValue,
} from "@maestro-template/agent-pack";
import type { CliResult } from "../types";
import { cliSuccess } from "../result";
import { runAgentPackCommandAsCli, type FactoryCliRenderMode } from "./router";

export const ADD_HELP =
  "maestro add <outcome-or-recipe> [--answer <question>=<value>] [--write] [--human|--details|--json]\n";
export const RECIPES_HELP =
  "maestro recipes list|show <recipe-id> [--human|--details|--json]\n";

type RecipeCommands<
  AddArgs,
  AddData extends AgentPackJsonValue,
  RecipesArgs,
  RecipesData extends AgentPackJsonValue,
> = {
  readonly add: AgentPackCommand<"add", AddArgs, AddData>;
  readonly recipes: AgentPackCommand<"recipes", RecipesArgs, RecipesData>;
};

export function createRecipeCliHandlers<
  AddArgs,
  AddData extends AgentPackJsonValue,
  RecipesArgs,
  RecipesData extends AgentPackJsonValue,
>(commands: RecipeCommands<AddArgs, AddData, RecipesArgs, RecipesData>) {
  return [
    {
      command: "add",
      run: (argv: readonly string[], cwd: string): Promise<CliResult> =>
        argv.length === 2 && argv[1] === "--help"
          ? Promise.resolve(cliSuccess(ADD_HELP))
          : run(commands.add, parseAdd(argv.slice(1)), cwd),
    },
    {
      command: "recipes",
      run: (argv: readonly string[], cwd: string): Promise<CliResult> =>
        argv.length === 2 && argv[1] === "--help"
          ? Promise.resolve(cliSuccess(RECIPES_HELP))
          : run(commands.recipes, parseRecipes(argv.slice(1)), cwd),
    },
  ] as const;
}

function run<Args, Data extends AgentPackJsonValue>(
  command: AgentPackCommand<string, Args, Data>,
  parsed: {
    readonly input: unknown;
    readonly renderMode: FactoryCliRenderMode;
  },
  cwd: string,
): Promise<CliResult> {
  return runAgentPackCommandAsCli(
    command,
    parsed.input,
    {
      schemaVersion: AGENT_PACK_EXECUTION_CONTEXT_VERSION,
      invocation: "cli",
      repo: createRepositoryContext({ cwd }),
    },
    parsed.renderMode,
  );
}

function parseAdd(argv: readonly string[]) {
  const query = argv[0];
  const answers: Record<string, string | boolean> = {};
  let renderMode: FactoryCliRenderMode = "human";
  let write = false;
  const seen = new Set<string>();
  let valid = query !== undefined && !query.startsWith("--");
  for (let index = 1; index < argv.length; index += 1) {
    const token = argv[index];
    const mode = renderModeFor(token);
    if (mode !== undefined) {
      renderMode = mode;
      continue;
    }
    if (token === "--write") {
      if (seen.has(token)) valid = false;
      seen.add(token);
      write = true;
      continue;
    }
    const pair = argv[index + 1];
    if (token !== "--answer" || pair === undefined) {
      valid = false;
      continue;
    }
    index += 1;
    const separator = pair.indexOf("=");
    if (separator < 1 || separator === pair.length - 1) {
      valid = false;
      continue;
    }
    const value = pair.slice(separator + 1);
    answers[pair.slice(0, separator)] =
      value === "true" ? true : value === "false" ? false : value;
  }
  return {
    input: valid
      ? {
          query,
          answers,
          write,
        }
      : {},
    renderMode,
  };
}

function parseRecipes(argv: readonly string[]) {
  let renderMode: FactoryCliRenderMode = "human";
  const positional: string[] = [];
  for (const token of argv) {
    const mode = renderModeFor(token);
    if (mode === undefined) positional.push(token);
    else renderMode = mode;
  }
  const input =
    positional.length === 1 && positional[0] === "list"
      ? { action: "list" }
      : positional.length === 2 && positional[0] === "show"
        ? { action: "show", id: positional[1] }
        : {};
  return { input, renderMode };
}

function renderModeFor(
  token: string | undefined,
): FactoryCliRenderMode | undefined {
  if (token === "--json") return "json";
  if (token === "--details") return "details";
  if (token === "--human") return "human";
  return undefined;
}
