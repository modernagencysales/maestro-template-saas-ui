import { chmod, mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { build } from "esbuild";

const packageRoot = fileURLToPath(new URL("./", import.meta.url));

export async function buildCliExecutable(input: {
  readonly sourceSha: string;
  readonly outputFile?: string;
  readonly metadataFile?: string;
}): Promise<void> {
  if (!/^[0-9a-f]{7,64}$/u.test(input.sourceSha))
    throw new Error(
      "MAESTRO_PROTECTED_CHECKOUT_SHA must be a lowercase Git SHA.",
    );
  const outputFile =
    input.outputFile ??
    fileURLToPath(new URL("./dist/maestro.mjs", import.meta.url));
  const metadataFile =
    input.metadataFile ??
    fileURLToPath(new URL("./dist/maestro.meta.json", import.meta.url));
  await mkdir(fileURLToPath(new URL("./dist/", import.meta.url)), {
    recursive: true,
  });
  const result = await build({
    entryPoints: [`${packageRoot}src/index.ts`],
    outfile: outputFile,
    bundle: true,
    platform: "node",
    target: "node22",
    format: "esm",
    sourcemap: false,
    metafile: true,
    define: {
      __MAESTRO_CLI_SOURCE_SHA__: JSON.stringify(input.sourceSha),
    },
    banner: { js: "#!/usr/bin/env node" },
  });
  const runtimeImports = Object.values(result.metafile.outputs).flatMap(
    (output) =>
      output.imports.map(({ path, external }) => ({ path, external })),
  );
  if (runtimeImports.some(({ path }) => !path.startsWith("node:")))
    throw new Error("CLI bundle retains a non-Node runtime import.");
  await writeFile(
    metadataFile,
    `${JSON.stringify(
      {
        schemaVersion: 1,
        sourceSha: input.sourceSha,
        outputFile,
        runtimeImports,
        metafile: result.metafile,
      },
      null,
      2,
    )}\n`,
  );
  await chmod(outputFile, 0o755);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await buildCliExecutable({
    sourceSha: process.env.MAESTRO_PROTECTED_CHECKOUT_SHA ?? "",
  });
}
