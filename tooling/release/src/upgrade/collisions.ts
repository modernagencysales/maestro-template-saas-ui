import type {
  UpgradeDiffEntry,
  UpgradeManifestV1,
  UpgradeOperationV1,
  UpgradeResolution,
  UpgradeTargetV1,
} from "./contract.js";

const compareText = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;

const resolution = (
  code: UpgradeResolution["code"],
  message: string,
  repair: string,
  operation?: UpgradeOperationV1,
  path?: string,
): UpgradeResolution => ({
  code,
  ...(operation ? { operationId: operation.id } : {}),
  ...(path ? { path } : {}),
  message,
  repair,
});

const classification = (
  operation: UpgradeOperationV1,
): UpgradeDiffEntry["classification"] => {
  switch (operation.kind) {
    case "add":
      return "add-template";
    case "modify":
      return "modify-template";
    case "move":
      return "move-template";
    case "delete":
      return "delete-template";
    case "regenerate":
      return "regenerate-generated";
  }
};

const asDiff = (operation: UpgradeOperationV1): UpgradeDiffEntry => ({
  operationId: operation.id,
  kind: operation.kind,
  classification: classification(operation),
  path: operation.path,
  ...(operation.fromPath ? { fromPath: operation.fromPath } : {}),
  ...(operation.beforeHash ? { beforeHash: operation.beforeHash } : {}),
  ...(operation.afterHash ? { afterHash: operation.afterHash } : {}),
});

export const analyzeUpgradeSafety = (
  manifest: UpgradeManifestV1,
  target: UpgradeTargetV1,
): {
  readonly diff: readonly UpgradeDiffEntry[];
  readonly resolutions: readonly UpgradeResolution[];
} => {
  const resolutions: UpgradeResolution[] = [];
  const files = new Map(target.files.map((file) => [file.path, file]));
  const pathParticipation = new Map<string, UpgradeOperationV1[]>();

  const participate = (path: string, operation: UpgradeOperationV1): void => {
    pathParticipation.set(path, [
      ...(pathParticipation.get(path) ?? []),
      operation,
    ]);
  };

  for (const operation of manifest.operations) {
    participate(operation.path, operation);
    if (operation.kind === "move" && operation.fromPath) {
      participate(operation.fromPath, operation);
    }
  }

  for (const [path, operations] of pathParticipation) {
    if (operations.length < 2) continue;
    for (const operation of operations) {
      resolutions.push(
        resolution(
          "UPGRADE_MOVE_AMBIGUOUS",
          `Path "${path}" participates in more than one upgrade operation.`,
          "Review the release migration and retain one unambiguous operation per source and destination path.",
          operation,
          path,
        ),
      );
    }
  }

  for (const operation of manifest.operations) {
    const sourcePath =
      operation.kind === "move" ? operation.fromPath : operation.path;
    const source = sourcePath ? files.get(sourcePath) : undefined;
    const destination = files.get(operation.path);

    if (operation.kind === "add") {
      if (destination) {
        resolutions.push(
          resolution(
            destination.ownership === "customer-owned"
              ? "UPGRADE_CUSTOMER_OVERLAP"
              : "UPGRADE_UNEXPECTED_PATH",
            `Add destination "${operation.path}" already exists as ${destination.ownership}.`,
            "Preserve the existing path and resolve the collision outside apply-safe.",
            operation,
            operation.path,
          ),
        );
      }
      continue;
    }

    if (!source || !sourcePath) {
      resolutions.push(
        resolution(
          "UPGRADE_PATH_MISSING",
          `Expected source path "${sourcePath ?? operation.path}" is missing.`,
          "Restore the exact prior release path or stop and resolve the target manually.",
          operation,
          sourcePath ?? operation.path,
        ),
      );
      continue;
    }
    if (source.ownership === "customer-owned") {
      resolutions.push(
        resolution(
          "UPGRADE_CUSTOMER_OVERLAP",
          `Operation overlaps customer-owned path "${sourcePath}".`,
          "Keep the customer path unchanged and resolve the migration with explicit human review.",
          operation,
          sourcePath,
        ),
      );
    } else if (source.ownership !== operation.ownership) {
      resolutions.push(
        resolution(
          "UPGRADE_OWNERSHIP_MISMATCH",
          `Path "${sourcePath}" is ${source.ownership}, not ${operation.ownership}.`,
          "Rebuild the plan from the reviewed ownership manifest and current target snapshot.",
          operation,
          sourcePath,
        ),
      );
    }
    if (operation.beforeHash && source.hash !== operation.beforeHash) {
      resolutions.push(
        resolution(
          "UPGRADE_HASH_MISMATCH",
          `Path "${sourcePath}" does not match the reviewed before hash.`,
          "Preserve the changed file and resolve the collision outside apply-safe.",
          operation,
          sourcePath,
        ),
      );
    }
    if (
      operation.kind === "move" &&
      destination &&
      operation.path !== sourcePath
    ) {
      resolutions.push(
        resolution(
          destination.ownership === "customer-owned"
            ? "UPGRADE_CUSTOMER_OVERLAP"
            : "UPGRADE_UNEXPECTED_PATH",
          `Move destination "${operation.path}" already exists as ${destination.ownership}.`,
          "Do not overwrite the destination; resolve the move collision explicitly.",
          operation,
          operation.path,
        ),
      );
    }
  }

  return {
    diff: manifest.operations.map(asDiff).sort((left, right) => {
      const path = compareText(left.path, right.path);
      return path === 0
        ? compareText(left.operationId, right.operationId)
        : path;
    }),
    resolutions: resolutions.sort((left, right) => {
      const code = compareText(left.code, right.code);
      if (code !== 0) return code;
      const path = compareText(left.path ?? "", right.path ?? "");
      return path === 0
        ? compareText(left.operationId ?? "", right.operationId ?? "")
        : path;
    }),
  };
};
