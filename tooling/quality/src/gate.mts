import { access, readFile } from "node:fs/promises";
import { join } from "node:path";

export type StaticRequirement = {
  file: string;
  includes?: string[];
  absent?: string[];
  message: string;
};

export type StaticCheckDescriptor = {
  name: string;
  requirements: StaticRequirement[];
};
export type StaticCheckEvidenceClass =
  "static" | "behavioral" | "runtime" | "live-promotion" | "advisory";
export type StaticCheckPosture = "required" | "advisory";
export type StaticCheckDiagnosticMetadata = {
  readonly gateId: string;
  readonly posture: StaticCheckPosture;
  readonly evidenceClass: StaticCheckEvidenceClass;
  readonly canonicalDoc: string;
  readonly repairHint: string;
  readonly argv: readonly [string, ...string[]];
  readonly rerun: readonly [string, ...string[]];
  readonly focusedPathPrefixes: readonly string[];
  readonly defaultFocused?: boolean;
  readonly prerequisiteCheck?: readonly [string, ...string[]];
  readonly semanticRuleIds?: readonly string[];
};
export type RegisteredStaticCheckDescriptor = StaticCheckDescriptor &
  StaticCheckDiagnosticMetadata;

export type StaticCheckResult = {
  ok: boolean;
  failures: string[];
};

export async function evaluateStaticCheck(
  repoRoot: string,
  descriptor: StaticCheckDescriptor,
): Promise<StaticCheckResult> {
  const failures: string[] = [];

  for (const requirement of descriptor.requirements) {
    const fullPath = join(repoRoot, requirement.file);
    let content = "";

    try {
      await access(fullPath);
      content = await readFile(fullPath, "utf8");
    } catch {
      failures.push(`${requirement.message}: missing ${requirement.file}`);
      continue;
    }

    const normalizedContent = content.replace(/\s+/gu, " ");
    for (const expected of requirement.includes ?? []) {
      if (!normalizedContent.includes(expected.replace(/\s+/gu, " "))) {
        failures.push(
          `${requirement.message}: ${requirement.file} is missing \`${expected}\``,
        );
      }
    }

    for (const forbidden of requirement.absent ?? []) {
      if (content.includes(forbidden)) {
        failures.push(
          `${requirement.message}: ${requirement.file} contains forbidden \`${forbidden}\``,
        );
      }
    }
  }

  return { ok: failures.length === 0, failures };
}

export async function runStaticCheck(
  descriptor: StaticCheckDescriptor,
  repoRoot = process.cwd(),
): Promise<void> {
  const result = await evaluateStaticCheck(repoRoot, descriptor);

  if (result.ok) {
    console.log(`${descriptor.name}: ok`);
    return;
  }

  for (const failure of result.failures) {
    console.error(`${descriptor.name}: ${failure}`);
  }
  process.exitCode = 1;
}
