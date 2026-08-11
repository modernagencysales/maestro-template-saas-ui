import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  composeAppMap,
  resolveRepositoryRevision,
} from "../app-map/src/composition";
import {
  RecordsCustomerMaterializationError,
  withMaterializedRecordsCustomer,
} from "../../apps/cli/src/factory/customerCandidateFixture";
import { checkProductContract } from "./product-contract.mts";

export { RecordsCustomerMaterializationError, withMaterializedRecordsCustomer };

const checkMaterializedCustomerContract = async (
  targetRoot: string,
  options: {
    readonly repoRoot: string;
    readonly sourceRoot: "examples/saas-application/seed/source";
    readonly allowFirstContract: boolean;
  },
): Promise<readonly string[]> => {
  const revision = await resolveRepositoryRevision(targetRoot);
  const composed = await composeAppMap({ repoRoot: targetRoot, revision });
  if (!composed.ok) throw new Error(composed.message);
  return checkProductContract({
    repoRoot: options.repoRoot,
    sourceRoot: options.sourceRoot,
    allowFirstContract: options.allowFirstContract,
    resolveAppMapNodeIds: async () =>
      new Set(composed.build.map.nodes.map(({ id }) => id)),
  });
};

export const checkTemplateProductContract = async (options: {
  readonly repoRoot: string;
  readonly sourceRoot: "examples/saas-application/seed/source";
  readonly allowFirstContract: boolean;
  readonly targetRoot?: string;
}): Promise<readonly string[]> =>
  options.targetRoot === undefined
    ? withMaterializedRecordsCustomer(options.repoRoot, async (targetRoot) =>
        checkMaterializedCustomerContract(targetRoot, options),
      )
    : checkMaterializedCustomerContract(options.targetRoot, options);

const main = async (): Promise<void> => {
  const args = process.argv.slice(2);
  if (
    args.length !== 4 ||
    args[0] !== "check" ||
    args[1] !== "--source-root" ||
    args[2] !== "examples/saas-application/seed/source" ||
    args[3] !== "--allow-first-contract"
  )
    throw new Error(
      "usage: template-product-contract.mts check --source-root examples/saas-application/seed/source --allow-first-contract",
    );
  const findings = await checkTemplateProductContract({
    repoRoot: resolve(dirname(fileURLToPath(import.meta.url)), "../.."),
    sourceRoot: "examples/saas-application/seed/source",
    allowFirstContract: true,
  });
  if (findings.length > 0) throw new Error(findings.join("\n"));
};

if (process.argv[1]?.endsWith("template-product-contract.mts"))
  void main().catch((error: unknown) => {
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 1;
  });
