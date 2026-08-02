import { afterEach, describe, expect, it, vi } from "vitest";

import {
  formatGateComment,
  markerFor,
  upsertGateComment,
} from "./post-ai-gate-comment.mts";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("post-ai-gate-comment formatting", () => {
  it("formats contract-review blockers as sticky PR feedback", () => {
    const body = formatGateComment({
      gate: "contract-review",
      repo: "example-org/example-repo",
      prNumber: 278,
      sha: "bb90bdc3a82ce8b8fa05814a815ca4840702ae6c",
      buildUrl: "https://ci.example.test/repos/1/pipeline/541",
      verdict: {
        verdict: "block",
        findings: [
          {
            severity: "red",
            path: "packages/convex/schema.ts",
            line: 42,
            issue: "Schema imports a capability.",
            contract: "layer law",
            fix: "Move the dependency below schema.",
            clause: "LAYER_LAW",
            confidence: "high",
            mechanicalGateCandidate: "depcruise",
            applyability: "exact",
          },
        ],
      },
    });

    expect(body).toMatch(new RegExp(markerFor("contract-review")));
    expect(body).toMatch(/Contract review blocked/);
    expect(body).toMatch(/packages\/convex\/schema\.ts:42/);
    expect(body).toMatch(/Move the dependency below schema/);
    expect(body).toMatch(/Machine-readable verdict JSON/);
    expect(body).toMatch(/bb90bdc3a82/);
  });

  it("formats taste pass comments so stale blockers are cleared", () => {
    const body = formatGateComment({
      gate: "taste",
      repo: "example-org/example-repo",
      prNumber: 260,
      sha: "5da30e06c6f906fdef833da140cf46bea12f42ef",
      buildUrl: null,
      verdict: { verdict: "pass", files: [] },
    });

    expect(body).toMatch(new RegExp(markerFor("taste")));
    expect(body).toMatch(/Taste review passed/);
    expect(body).toMatch(/No blocking findings for this commit/);
    expect(body).not.toMatch(/Build:/);
  });

  it("formats taste pass nits as non-blocking PR feedback", () => {
    const body = formatGateComment({
      gate: "taste",
      repo: "example-org/example-repo",
      prNumber: 260,
      sha: "5da30e06c6f906fdef833da140cf46bea12f42ef",
      buildUrl: "https://ci.example.test/repos/1/pipeline/1011",
      verdict: {
        verdict: "pass",
        files: [
          {
            file: "packages/convex/adapters/errors.ts",
            verdict: {
              verdict: "pass",
              findings: [
                {
                  line: 113,
                  severity: "nit",
                  issue: "The alias adds no clarity.",
                  fix: "Inline the literal or broaden the grouping.",
                },
              ],
            },
          },
        ],
      },
    });

    expect(body).toMatch(/Taste review passed/);
    expect(body).toMatch(/No blocking findings for this commit/);
    expect(body).toMatch(/Non-blocking findings:/);
    expect(body).toMatch(/packages\/convex\/adapters\/errors\.ts:113/);
    expect(body).toMatch(/Inline the literal or broaden the grouping/);
  });

  it("numbers taste blocker findings sequentially", () => {
    const body = formatGateComment({
      gate: "taste",
      repo: "example-org/example-repo",
      prNumber: 283,
      sha: "cad8863fbe42b042fd1fc547ce0aa5c60a009ef4",
      buildUrl: null,
      verdict: {
        verdict: "block",
        files: [
          {
            file: "apps/web/app/page.tsx",
            verdict: {
              verdict: "block",
              findings: [
                {
                  line: 10,
                  severity: "block",
                  issue: "The component does too many things.",
                  fix: "Split the data adapter from the view.",
                },
                {
                  line: 20,
                  severity: "block",
                  issue: "The name hides the state transition.",
                  fix: "Rename it to match the transition.",
                },
              ],
            },
          },
        ],
      },
    });

    expect(body).toMatch(/1\. `apps\/web\/app\/page\.tsx:10`/);
    expect(body).toMatch(/2\. `apps\/web\/app\/page\.tsx:20`/);
    expect(body).not.toMatch(/3\. `apps\/web\/app\/page\.tsx:20`/);
  });
});

describe("post-ai-gate-comment upserts", () => {
  it("creates a marker issue comment for a blocked gate", async () => {
    const requests: Array<{
      readonly url: string;
      readonly method: string;
      readonly body: unknown;
    }> = [];
    vi.stubGlobal("fetch", (async (
      input: string | URL | Request,
      init?: Parameters<typeof fetch>[1],
    ) => {
      const method = init?.method ?? "GET";
      const body =
        typeof init?.body === "string" ? JSON.parse(init.body) : undefined;
      requests.push({ url: String(input), method, body });
      if (method === "GET") return Response.json([]);
      if (method === "POST")
        return Response.json({ id: 123, body }, { status: 201 });
      throw new Error(`unexpected ${method}`);
    }) as typeof fetch);

    const result = await upsertGateComment({
      token: "token",
      comment: {
        gate: "taste",
        repo: "example-org/example-repo",
        prNumber: 344,
        sha: "2ca35dc7f41e7bafb71e569d3160df8cd757afb7",
        buildUrl: null,
        verdict: {
          verdict: "block",
          files: [
            {
              file: "apps/web/app/page.tsx",
              verdict: {
                verdict: "block",
                findings: [
                  {
                    line: 1,
                    severity: "block",
                    issue: "Opaque gate failure.",
                    fix: "Publish the finding.",
                  },
                ],
              },
            },
          ],
        },
      },
    });

    expect(result).toBe("created");
    expect(requests[1]?.method).toBe("POST");
    expect(requests[1]?.url).toMatch(
      /\/repos\/example-org\/example-repo\/issues\/344\/comments$/,
    );
    expect(
      String((requests[1]?.body as { body?: string } | undefined)?.body ?? ""),
    ).toMatch(new RegExp(markerFor("taste")));
  });

  it("updates the existing marker issue comment", async () => {
    const requests: Array<{
      readonly url: string;
      readonly method: string;
      readonly body: unknown;
    }> = [];
    vi.stubGlobal("fetch", (async (
      input: string | URL | Request,
      init?: Parameters<typeof fetch>[1],
    ) => {
      const method = init?.method ?? "GET";
      const body =
        typeof init?.body === "string" ? JSON.parse(init.body) : undefined;
      requests.push({ url: String(input), method, body });
      if (method === "GET") {
        return Response.json([
          { id: 456, body: `${markerFor("contract-review")}\nstale` },
        ]);
      }
      if (method === "PATCH") return Response.json({ id: 456, body });
      throw new Error(`unexpected ${method}`);
    }) as typeof fetch);

    const result = await upsertGateComment({
      token: "token",
      comment: {
        gate: "contract-review",
        repo: "example-org/example-repo",
        prNumber: 344,
        sha: "2ca35dc7f41e7bafb71e569d3160df8cd757afb7",
        buildUrl: "https://ci.example.test/repos/1/pipeline/1236",
        verdict: { verdict: "pass", findings: [] },
      },
    });

    expect(result).toBe("updated");
    expect(requests[1]?.method).toBe("PATCH");
    expect(requests[1]?.url).toMatch(/\/issues\/comments\/456$/);
    expect(
      String((requests[1]?.body as { body?: string } | undefined)?.body ?? ""),
    ).toMatch(/Contract review passed/);
  });

  it("surfaces GitHub comment API failures with path and status", async () => {
    vi.stubGlobal("fetch", (async (
      _input: string | URL | Request,
      init?: Parameters<typeof fetch>[1],
    ) => {
      if ((init?.method ?? "GET") === "GET") return Response.json([]);
      return new Response("forbidden", { status: 403 });
    }) as typeof fetch);

    await expect(
      upsertGateComment({
        token: "token",
        comment: {
          gate: "taste",
          repo: "example-org/example-repo",
          prNumber: 344,
          sha: "2ca35dc7f41e7bafb71e569d3160df8cd757afb7",
          buildUrl: null,
          verdict: { verdict: "block", files: [] },
        },
      }),
    ).rejects.toThrow(
      /GitHub POST \/repos\/example-org\/example-repo\/issues\/344\/comments failed with 403/,
    );
  });
});
