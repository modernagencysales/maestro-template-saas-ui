import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { dirname, relative, resolve } from "node:path";

import { STARTER_COMMIT, starterFiles } from "./manifest.ts";

export type TransplantOptions = Readonly<{
  starterRoot: string;
  targetRoot: string;
  ids: readonly string[];
  expectedCommit?: string;
  receiptPath?: string;
  receiptOnly?: boolean;
}>;

export type TransplantedFile = Readonly<{
  source: string;
  destination: string;
  sourceSha256: string;
  sha256: string;
  adapted: boolean;
}>;

type StarterReceipt = Readonly<{
  schemaVersion: 1;
  sourceCommit: string;
  files: readonly Readonly<{
    source: string;
    destination: string;
    sourceSha256: string;
    sha256: string;
    adapted: boolean;
  }>[];
}>;

const digest = (contents: Buffer) =>
  createHash("sha256").update(contents).digest("hex");

export function verifyStarterSourceCommit(
  starterRoot: string,
  expectedCommit = STARTER_COMMIT,
): string {
  const actual = execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: starterRoot,
    encoding: "utf8",
  }).trim();
  if (actual !== expectedCommit)
    throw new Error(`Starter checkout ${actual}; expected ${expectedCommit}`);
  const status = execFileSync(
    "git",
    [
      "status",
      "--porcelain",
      "--untracked-files=all",
      "--",
      "apps/web/src",
      "packages/config",
      "packages/i18n",
      "packages/ui",
    ],
    { cwd: starterRoot, encoding: "utf8" },
  ).trim();
  if (status)
    throw new Error(`Starter working tree is not clean: ${starterRoot}`);
  return actual;
}

export async function transplantStarter({
  starterRoot,
  targetRoot,
  ids,
  expectedCommit = STARTER_COMMIT,
  receiptPath = resolve(
    targetRoot,
    "../../docs/template/saas-ui-starter-files.json",
  ),
  receiptOnly = false,
}: TransplantOptions): Promise<readonly TransplantedFile[]> {
  const actual = verifyStarterSourceCommit(starterRoot, expectedCommit);
  const manifestIds = ids.filter((id) => id !== "support");
  const supportFiles = ids.includes("support")
    ? execFileSync(
        "git",
        [
          "ls-tree",
          "-r",
          "--name-only",
          "HEAD",
          "--",
          "packages/config",
          "packages/i18n",
          "packages/ui",
        ],
        { cwd: starterRoot, encoding: "utf8" },
      )
        .trim()
        .split("\n")
        .filter(Boolean)
        .map((source) => ({ source, destination: `../../${source}` }))
    : [];

  const files: TransplantedFile[] = [];
  for (const file of [...starterFiles(manifestIds), ...supportFiles]) {
    const source = resolve(starterRoot, file.source);
    const destination = resolve(targetRoot, file.destination);
    const sourceContents = await readFile(source);
    if (!receiptOnly) {
      await mkdir(dirname(destination), { recursive: true });
      await copyFile(source, destination);
    }
    const destinationContents = await readFile(destination);
    files.push({
      source,
      destination,
      sourceSha256: digest(sourceContents),
      sha256: digest(destinationContents),
      adapted: digest(sourceContents) !== digest(destinationContents),
    });
  }

  const receipt: StarterReceipt = {
    schemaVersion: 1,
    sourceCommit: actual,
    files: files
      .map((file) => ({
        source: relative(starterRoot, file.source).split("/").join("/"),
        destination: relative(
          resolve(dirname(receiptPath), "../.."),
          file.destination,
        ),
        sourceSha256: file.sourceSha256,
        sha256: file.sha256,
        adapted: file.adapted,
      }))
      .sort((left, right) =>
        left.destination.localeCompare(right.destination, "en"),
      ),
  };
  await mkdir(dirname(receiptPath), { recursive: true });
  await writeFile(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");
  return files;
}

if (process.argv[1]?.endsWith("transplant-starter.mts")) {
  const starterIndex = process.argv.indexOf("--starter-root");
  const idsIndex = process.argv.indexOf("--ids");
  const starterRoot =
    starterIndex >= 0 ? process.argv[starterIndex + 1] : undefined;
  const ids =
    idsIndex >= 0 ? process.argv[idsIndex + 1]?.split(",") : undefined;
  if (!starterRoot || !ids?.length) {
    throw new Error(
      "Usage: transplant-starter.mts --starter-root <path> --ids <id,...>",
    );
  }
  const result = await transplantStarter({
    starterRoot,
    targetRoot: resolve(process.cwd(), "apps/web"),
    ids,
    receiptOnly: process.argv.includes("--receipt-only"),
  });
  console.log(`Recorded ${result.length} starter files.`);
}
