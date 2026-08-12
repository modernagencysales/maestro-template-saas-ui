import { resolve } from "node:path";

export type GoldenPreviewCommand = Readonly<{
  cwd: string;
  command: "pnpm";
  args: readonly string[];
}>;

export function previewCommand(input: {
  repositoryRoot: string;
  targetRoot: string;
  authority: "reference" | "generated";
  port: string;
}): GoldenPreviewCommand {
  const appRoot = resolve(
    input.authority === "generated" ? input.targetRoot : input.repositoryRoot,
    "apps/web",
  );
  return {
    cwd: appRoot,
    command: "pnpm",
    args: [
      "--dir",
      appRoot,
      "preview",
      "--host",
      "127.0.0.1",
      "--port",
      input.port,
    ],
  };
}
