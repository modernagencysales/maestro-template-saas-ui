import { createServer } from "node:net";

export type DemoArgs = {
  readonly host: string;
  readonly port: number;
  readonly openBrowser: boolean;
  readonly verifyOnly: boolean;
};

export type DemoPageContract = {
  readonly requiredText: readonly string[];
  readonly forbiddenText: readonly string[];
};

export const parseDemoArgs = (args: readonly string[]): DemoArgs => {
  let port = 5199;
  let openBrowser = true;
  let verifyOnly = false;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--no-open") {
      openBrowser = false;
      continue;
    }
    if (argument === "--verify-only") {
      verifyOnly = true;
      openBrowser = false;
      continue;
    }
    if (argument === "--port") {
      const candidate = Number(args[index + 1]);
      if (!Number.isInteger(candidate) || candidate < 1 || candidate > 65_535) {
        throw new Error("--port must be a valid TCP port.");
      }
      port = candidate;
      index += 1;
      continue;
    }
    throw new Error(`Unknown demo option: ${argument}`);
  }

  return { host: "127.0.0.1", port, openBrowser, verifyOnly };
};

export const assertCanonicalBranch = (
  actual: string,
  canonical: string,
): void => {
  if (actual !== canonical) {
    throw new Error(
      `Refusing to launch from ${actual || "a detached checkout"}; use the canonical branch ${canonical}.`,
    );
  }
};

export const assertDemoPageText = (
  pageText: string,
  contract: DemoPageContract,
): void => {
  for (const marker of contract.forbiddenText) {
    if (pageText.includes(marker)) {
      throw new Error(`Demo rendered forbidden marker ${marker}.`);
    }
  }
  for (const marker of contract.requiredText) {
    if (!pageText.includes(marker)) {
      throw new Error(`Demo is missing required marker ${marker}.`);
    }
  }
};

export const assertPortAvailable = async (
  host: string,
  port: number,
): Promise<void> => {
  await new Promise<void>((resolve, reject) => {
    const probe = createServer();
    probe.once("error", () => {
      reject(
        new Error(
          `Port ${host}:${port} is already occupied. Stop the known process or choose --port <number>; the demo will not silently reuse or replace it.`,
        ),
      );
    });
    probe.listen(port, host, () => {
      probe.close((error) => (error ? reject(error) : resolve()));
    });
  });
};
