import {
  AGENT_PACK_EXECUTION_CONTEXT_VERSION,
  createAddRecipeCommand,
  createNodeRecipeTransaction,
  createRecipesCommand,
  executeAgentPackCommand,
  sha256RecipeBytes,
  type AgentPackExecutionContext,
  type createPreflightCommand,
} from "@maestro-template/agent-pack";
import {
  resolveReviewedGenerator,
  runReviewedGenerator,
} from "@maestro-template/generators";
import { existsSync, lstatSync, readFileSync } from "node:fs";
import { isAbsolute, resolve, win32 } from "node:path";
import { loadRecipeCatalogProjection } from "./recipeCatalog";
import { createRecipeCliHandlers } from "./recipes";

type RecipeRepo = AgentPackExecutionContext["repo"];

const inspectRecipePreflight = async (
  preflight: ReturnType<typeof createPreflightCommand>,
  repo: RecipeRepo,
) => {
  const result = await executeAgentPackCommand(
    preflight,
    { mode: "fake" },
    {
      schemaVersion: AGENT_PACK_EXECUTION_CONTEXT_VERSION,
      invocation: "library",
      repo,
    },
  );
  if (result.data === null) {
    return {
      fingerprint: "recipe_preflight_sha256:unavailable",
      safeToMutate: false,
      cleanWorktree: false,
    };
  }
  const { facts } = result.data;
  const stableMutationEvidence = {
    repo,
    host: facts.host,
    prerequisites: { dependencies: facts.prerequisites.dependencies },
    repository: facts.repository,
    versionsCompatible: facts.versionsCompatible,
    versions: facts.versions,
    workflow: facts.workflow,
    app: facts.app,
  };
  return {
    fingerprint: `recipe_preflight_${sha256RecipeBytes(
      JSON.stringify(stableMutationEvidence),
    )}`,
    safeToMutate: result.data.safeToMutate,
    cleanWorktree: facts.repository.dirty === false,
  };
};

const resolveRecipeGenerator = (generatorId: string) => {
  const result = resolveReviewedGenerator(generatorId);
  return result.supported
    ? {
        supported: true as const,
        version: `reviewed-generator-v1:${generatorId}`,
      }
    : { supported: false as const };
};

const addBeforeHash = <File extends { readonly path: string }>(
  file: File,
  targetRoot: string,
): File & { readonly beforeSha256: string | null } => {
  if (isUnsafeReviewedGeneratorPath(file.path)) {
    throw new Error(`Reviewed generator emitted unsafe path ${file.path}.`);
  }
  const target = resolve(targetRoot, file.path);
  if (!existsSync(target)) return { ...file, beforeSha256: null };
  const stats = lstatSync(target);
  if (!stats.isFile() || stats.isSymbolicLink()) {
    throw new Error(
      `Reviewed generator target is not a regular file: ${file.path}.`,
    );
  }
  return {
    ...file,
    beforeSha256: sha256RecipeBytes(readFileSync(target)),
  };
};

const previewRecipeGenerator = async ({
  generatorId,
  args,
  repo,
}: {
  readonly generatorId: string;
  readonly args: Readonly<Record<string, string | boolean>>;
  readonly repo: RecipeRepo;
}) => {
  const result = runReviewedGenerator({
    generatorId,
    args,
    write: false,
    cwd: repo.targetRoot,
  });
  if (!result.ok) return result;
  try {
    return {
      ok: true as const,
      output: {
        ...result.output,
        files: result.output.files.map((file) =>
          addBeforeHash(file, repo.targetRoot),
        ),
      },
    };
  } catch (error) {
    return {
      ok: false as const,
      message:
        error instanceof Error
          ? error.message
          : "Recipe generator preview failed.",
    };
  }
};

export function createCustomerRecipeCliHandlers(
  preflight: ReturnType<typeof createPreflightCommand>,
) {
  const dependencies = {
    load: (repo: AgentPackExecutionContext["repo"]) =>
      loadRecipeCatalogProjection(repo.sourceRoot),
    generators: {
      resolve: resolveRecipeGenerator,
      preview: previewRecipeGenerator,
    },
    preflight: {
      inspect: (repo: RecipeRepo) => inspectRecipePreflight(preflight, repo),
    },
    transaction: createNodeRecipeTransaction(),
  };
  return createRecipeCliHandlers({
    add: createAddRecipeCommand(dependencies),
    recipes: createRecipesCommand(dependencies),
  });
}

function isUnsafeReviewedGeneratorPath(filePath: string): boolean {
  return (
    isAbsolute(filePath) ||
    win32.isAbsolute(filePath) ||
    filePath.split(/[\\/]/u).some((part) => part === "..")
  );
}
