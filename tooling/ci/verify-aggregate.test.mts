import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const verifier = resolve("tooling/ci/verify-aggregate.mjs");

describe("Woodpecker verification aggregation", () => {
  it("passes only when both required workflows succeeded", async () => {
    const result = await runVerifier(200, {
      workflows: [
        { name: "verify-core", state: "success" },
        { name: "verify-coverage", state: "success" },
      ],
    });

    expect(result).toEqual({ code: 0, stderr: "" });
  });

  it.each([
    [
      "a dependency failed",
      200,
      {
        workflows: [
          { name: "verify-core", state: "success" },
          { name: "verify-coverage", state: "failure" },
        ],
      },
    ],
    [
      "a dependency is missing",
      200,
      { workflows: [{ name: "verify-core", state: "success" }] },
    ],
    ["the API is unavailable", 503, { error: "unavailable" }],
  ] as const)("fails closed when %s", async (_label, status, body) => {
    const result = await runVerifier(status, body);

    expect(result.code).toBe(1);
    expect(result.stderr).toContain("verify-aggregate:");
  });
});

async function runVerifier(status: number, body: unknown) {
  const server = createServer((request, response) => {
    expect(request.url).toBe("/api/repos/3/pipelines/259");
    response.writeHead(status, { "content-type": "application/json" });
    response.end(JSON.stringify(body));
  });
  await new Promise<void>((resolveListen) => server.listen(0, resolveListen));
  const address = server.address();
  if (address === null || typeof address === "string") {
    server.close();
    throw new Error("test server did not bind a TCP port");
  }

  try {
    const child = spawn(process.execPath, [verifier], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        CI_PIPELINE_URL: `http://127.0.0.1:${address.port}/repos/3/pipeline/259`,
      },
      stdio: ["ignore", "ignore", "pipe"],
    });
    let stderr = "";
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });
    const code = await new Promise<number | null>((resolveExit, reject) => {
      child.once("error", reject);
      child.once("close", resolveExit);
    });
    return { code, stderr };
  } finally {
    await new Promise<void>((resolveClose, reject) =>
      server.close((error) => (error ? reject(error) : resolveClose())),
    );
  }
}
