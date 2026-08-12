import { createHash } from "node:crypto";
import { copyFileSync, mkdirSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";

import { STARTER_COMMIT, starterFiles } from "./manifest.ts";

export type TransplantOptions = Readonly<{
  starterRoot: string;
  targetRoot: string;
  ids: readonly string[];
  expectedCommit?: string;
}>;

export type TransplantedFile = Readonly<{
  source: string;
  destination: string;
  sha256: string;
}>;

export async function transplantStarter({
  starterRoot,
  targetRoot,
  ids,
  expectedCommit = STARTER_COMMIT,
}: TransplantOptions): Promise<readonly TransplantedFile[]> {
  const actual = execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: starterRoot,
    encoding: "utf8",
  }).trim();
  if (actual !== expectedCommit) {
    throw new Error(`Starter checkout ${actual}; expected ${expectedCommit}`);
  }

  return starterFiles(ids).map((file) => {
    const source = resolve(starterRoot, file.source);
    const destination = resolve(targetRoot, file.destination);
    mkdirSync(dirname(destination), { recursive: true });
    copyFileSync(source, destination);
    return {
      ...file,
      source,
      destination,
      sha256: createHash("sha256")
        .update(readFileSync(destination))
        .digest("hex"),
    };
  });
}

if (process.argv[1]?.endsWith("transplant-starter.mts")) {
  const starterRoot = process.argv[process.argv.indexOf("--starter-root") + 1];
  const ids = process.argv[process.argv.indexOf("--ids") + 1]?.split(",") ?? [];
  if (!starterRoot || ids.length === 0) {
    throw new Error(
      "Usage: transplant-starter.mts --starter-root <path> --ids <id,...>",
    );
  }
  const targetRoot = resolve(process.cwd(), "apps/web");
  const result = await transplantStarter({ starterRoot, targetRoot, ids });
  for (const file of result) console.log(`${file.destination}\t${file.sha256}`);
}
