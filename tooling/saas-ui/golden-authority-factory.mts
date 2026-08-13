import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { buildSaasApplicationTargetPlan } from "../../tooling/generators/src/blueprints/saasApplication";

export type GoldenAuthorityMaterialization = Readonly<{
  targetRoot: string;
  digest: string;
}>;

const hashEntries = (entries: readonly { path: string; content: string }[]) => {
  const hash = createHash("sha256");
  for (const entry of entries) {
    hash.update(entry.path);
    hash.update("\0");
    hash.update(entry.content);
    hash.update("\0");
  }
  return hash.digest("hex");
};

export function materializeGoldenAuthorityTarget(input: {
  authority: "reference" | "generated";
  repositoryRoot: string;
  starterRoot: string;
  starterPin: string;
  referenceCompatibilityPaths: ReadonlySet<string>;
}): GoldenAuthorityMaterialization {
  const targetRoot = mkdtempSync(
    join(tmpdir(), `maestro-saas-ui-golden-${input.authority}-`),
  );
  const plan = buildSaasApplicationTargetPlan({
    name: "Golden customer target",
    firstOutcome: "Review the generated SaaS workspace",
  });
  for (const entry of plan.entries) {
    const target = join(targetRoot, entry.path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, entry.content);
  }

  if (input.authority === "reference") {
    const receipt = JSON.parse(
      readFileSync(
        resolve(
          input.repositoryRoot,
          "docs/template/saas-ui-starter-files.json",
        ),
        "utf8",
      ),
    ) as { files: readonly { source: string; destination: string }[] };
    cpSync(
      resolve(input.starterRoot, "apps/web/src/lib"),
      join(targetRoot, "apps/web/src/lib"),
      { recursive: true, force: true },
    );
    const starterDestinations = new Set(
      receipt.files.map(({ destination }) => destination),
    );
    for (const path of input.referenceCompatibilityPaths)
      starterDestinations.delete(path);
    for (const entry of plan.entries) {
      if (starterDestinations.has(entry.path)) continue;
      const target = join(targetRoot, entry.path);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, entry.content);
    }
    for (const file of receipt.files) {
      if (input.referenceCompatibilityPaths.has(file.destination)) continue;
      const target = join(targetRoot, file.destination);
      if (!existsSync(target)) continue;
      const source = execFileSync(
        "git",
        ["show", `${input.starterPin}:${file.source}`],
        { cwd: input.starterRoot },
      );
      writeFileSync(target, source);
    }
  }

  writeFileSync(
    join(targetRoot, ".golden-authority.json"),
    `${JSON.stringify(
      {
        authority: input.authority,
        materializedAt: new Date().toISOString(),
        source:
          input.authority === "reference"
            ? "pinned-starter-transplant"
            : "buildSaasApplicationTargetPlan",
        entries: plan.entries.length,
        digest: hashEntries(plan.entries),
      },
      null,
      2,
    )}\n`,
  );
  return { targetRoot, digest: hashEntries(plan.entries) };
}
