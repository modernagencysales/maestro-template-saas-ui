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
  const laneEvidence = taskIds.map((taskId) => {
    const laneDirectory = resolve(
      input.evidenceDirectory,
      "lane-results",
      safeSegment(taskId, "taskId"),
    );
    return {
      taskId,
      proof: readJson(resolve(laneDirectory, "ci-proof-packet.json")),
      gate: readJson(resolve(laneDirectory, "lane-gate-report.json")),
      result: readJson(resolve(laneDirectory, "lane-result.json")),
    };
  });
  const content = `${JSON.stringify(
    {
      schemaVersion: "maestro-brain-evidence-archive/v1",
      integrationId,
      manifestTranches,
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
      JSON.stringify(manifest.manifestTranches) !==
        JSON.stringify(manifestTranches) ||
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
        manifestTranches,
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
