import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { readJson, record, string } from "./integration-check-support.js";

export interface EvidenceArchiveInput {
  readonly evidenceDirectory: string;
  readonly integrationId: string;
  readonly manifestTranche?: string;
}

export interface EvidenceArchiveResult {
  readonly artifactPath: string;
  readonly contentSha256: string;
  readonly manifestPath: string;
}

const sha256 = (value: string): string =>
  createHash("sha256").update(value).digest("hex");

const safeSegment = (value: string, label: string): string => {
  if (!/^[A-Za-z0-9._-]+$/.test(value) || value === "." || value === "..") {
    throw new Error(`${label} is not a safe path segment`);
  }
  return value;
};

export const archiveIntegrationEvidence = (
  input: EvidenceArchiveInput,
): EvidenceArchiveResult => {
  const integrationId = safeSegment(input.integrationId, "integrationId");
  const integrationResult = readJson(
    resolve(
      input.evidenceDirectory,
      "integration",
      integrationId,
      "integration-result.json",
    ),
  );
  if (!Array.isArray(integrationResult.includedTasks)) {
    throw new Error("no included tasks to archive");
  }
  const taskIds = integrationResult.includedTasks
    .map((value, index) =>
      string(
        record(value, `includedTasks[${index}]`).taskId,
        `includedTasks[${index}].taskId`,
      ),
    )
    .sort();
  const manifestTranches = Array.isArray(integrationResult.manifestTranches)
    ? integrationResult.manifestTranches
    : input.manifestTranche
      ? [input.manifestTranche]
      : [];
  if (
    manifestTranches.length === 0 ||
    manifestTranches.some((value) => typeof value !== "string")
  ) {
    throw new Error("integration archive has no manifest tranche identity");
  }
  const legacyIdentity =
    integrationResult.schemaVersion === "maestro-brain-integration-result/v1";
  if (legacyIdentity && !input.manifestTranche) {
    throw new Error("legacy integration archive has no manifest tranche");
  }
  const trancheIdentity = legacyIdentity
    ? { manifestTranche: input.manifestTranche }
    : { manifestTranches };
  const laneEvidence = taskIds.map((taskId) => {
    const laneDirectory = resolve(
      input.evidenceDirectory,
      "lane-results",
      safeSegment(taskId, "taskId"),
    );
    const result = readJson(resolve(laneDirectory, "lane-result.json"));
    const reproof =
      typeof result.reproof === "object" && result.reproof !== null
        ? record(result.reproof, `${taskId}: reproof`)
        : undefined;
    const requestPath = reproof
      ? string(reproof.requestPath, `${taskId}: reproof requestPath`)
      : undefined;
    const reproofRequest = requestPath ? readJson(requestPath) : undefined;
    const priorEvidencePath = reproofRequest
      ? string(
          reproofRequest.priorEvidencePath,
          `${taskId}: reproof priorEvidencePath`,
        )
      : undefined;
    const priorEvidence = priorEvidencePath
      ? readJson(priorEvidencePath)
      : undefined;
    return {
      taskId,
      proof: readJson(resolve(laneDirectory, "ci-proof-packet.json")),
      gate: readJson(resolve(laneDirectory, "lane-gate-report.json")),
      result,
      ...(reproofRequest ? { reproofRequest } : {}),
      ...(priorEvidence ? { priorEvidence } : {}),
    };
  });
  const content = `${JSON.stringify(
    {
      schemaVersion: "maestro-brain-evidence-archive/v1",
      integrationId,
      ...trancheIdentity,
      integrationResult,
      laneEvidence,
    },
    null,
    2,
  )}\n`;
  const contentSha256 = sha256(content);
  const archiveDirectory = resolve(
    input.evidenceDirectory,
    "archive",
    integrationId,
  );
  const artifactPath = resolve(archiveDirectory, `${contentSha256}.json`);
  const manifestPath = resolve(archiveDirectory, "archive-manifest.json");
  const result = { artifactPath, contentSha256, manifestPath };

  if (existsSync(manifestPath)) {
    const manifest = readJson(manifestPath);
    if (
      manifest.schemaVersion !== "maestro-brain-evidence-archive-manifest/v1" ||
      manifest.integrationId !== integrationId ||
      (legacyIdentity
        ? manifest.manifestTranche !== input.manifestTranche
        : JSON.stringify(manifest.manifestTranches) !==
          JSON.stringify(manifestTranches)) ||
      manifest.contentSha256 !== contentSha256 ||
      manifest.artifactFile !== `${contentSha256}.json` ||
      !existsSync(artifactPath) ||
      sha256(readFileSync(artifactPath, "utf8")) !== contentSha256
    ) {
      throw new Error(`${integrationId}: archived evidence drift`);
    }
    return result;
  }

  mkdirSync(archiveDirectory, { recursive: true });
  if (existsSync(artifactPath)) {
    if (sha256(readFileSync(artifactPath, "utf8")) !== contentSha256) {
      throw new Error(`${integrationId}: archive artifact hash mismatch`);
    }
  } else {
    writeFileSync(artifactPath, content, { flag: "wx" });
  }
  writeFileSync(
    manifestPath,
    `${JSON.stringify(
      {
        schemaVersion: "maestro-brain-evidence-archive-manifest/v1",
        integrationId,
        ...trancheIdentity,
        contentSha256,
        artifactFile: `${contentSha256}.json`,
      },
      null,
      2,
    )}\n`,
    { flag: "wx" },
  );
  return result;
};
