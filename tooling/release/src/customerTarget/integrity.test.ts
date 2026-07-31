import { describe, expect, it } from "vitest";
import { validateCustomerTargetIntegrity } from "./integrity";

describe("customer target integrity", () => {
  it("reports unresolved workspace dependencies and missing document references", () => {
    const findings = validateCustomerTargetIntegrity({
      "package.json": JSON.stringify({
        name: "@example/root",
        dependencies: { "@example/missing": "workspace:*" },
      }),
      "docs/template/worker.md":
        "Follow `repos/confect/CLAUDE.md` before changing workflows.\n",
    });

    expect(findings).toEqual([
      {
        code: "MISSING_DOCUMENT_REFERENCE",
        path: "docs/template/worker.md",
        reference: "repos/confect/CLAUDE.md",
      },
      {
        code: "UNRESOLVED_WORKSPACE_DEPENDENCY",
        path: "package.json",
        reference: "@example/missing",
      },
    ]);
  });

  it("accepts workspace packages and shipped document references", () => {
    expect(
      validateCustomerTargetIntegrity({
        "package.json": JSON.stringify({
          name: "@example/root",
          dependencies: { "@example/worker": "workspace:*" },
        }),
        "packages/worker/package.json": JSON.stringify({
          name: "@example/worker",
        }),
        "docs/template/worker.md":
          "Follow [the worker guide](docs/template/shipped.md). `packages/worker/src/*.ts` is generated later.\n",
        "docs/template/shipped.md": "# Shipped\n",
      }),
    ).toEqual([]);
  });

  it("returns sorted deduplicated findings for dependency sections", () => {
    expect(
      validateCustomerTargetIntegrity({
        "apps/web/package.json": JSON.stringify({
          name: "@example/web",
          dependencies: { "@example/missing": "workspace:^" },
          devDependencies: { "@example/missing": "workspace:*" },
          optionalDependencies: { "@example/optional": "workspace:~" },
          peerDependencies: { react: "^19.0.0" },
        }),
      }),
    ).toEqual([
      {
        code: "UNRESOLVED_WORKSPACE_DEPENDENCY",
        path: "apps/web/package.json",
        reference: "@example/missing",
      },
      {
        code: "UNRESOLVED_WORKSPACE_DEPENDENCY",
        path: "apps/web/package.json",
        reference: "@example/optional",
      },
    ]);
  });
});
