import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  assertSaasUiTypecheckDiagnostics,
  createSaasUiTypecheckBaseline,
  type SaasUiTypecheckBaseline,
} from "./check-saas-ui-typecheck.mts";

const hash = (value: string): string =>
  createHash("sha256").update(value).digest("hex");

const baseline = (
  lockSha256: string,
  diagnosticCount = 0,
): SaasUiTypecheckBaseline => ({
  schemaVersion: 1,
  pnpmLockSha256: lockSha256,
  typescriptVersion: "5.9.3",
  diagnosticCount,
  diagnosticsSha256:
    diagnosticCount === 0
      ? hash("")
      : hash(
          JSON.stringify({
            path: "apps/web/src/components/paid.tsx",
            code: "TS2322",
          }),
        ),
});

const diagnostic = (
  path: string,
  message = "Type 'string' is not assignable to type 'number'.",
) => `${path}(1,1): error TS2322: ${message}\n`;

const writeJson = (path: string, value: unknown) => {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
};

const fixture = (registryAdapted = false) => {
  const root = mkdtempSync(join(tmpdir(), "saas-ui-typecheck-"));
  const paidPath = "apps/web/src/components/paid.tsx";
  const paidSource = "export const paid = true;\n";
  const lock = "lockfileVersion: '9.0'\n";
  mkdirSync(dirname(join(root, paidPath)), { recursive: true });
  writeFileSync(join(root, paidPath), paidSource);
  writeFileSync(join(root, "pnpm-lock.yaml"), lock);
  writeJson(join(root, "docs/template/saas-ui-starter-files.json"), {
    schemaVersion: 1,
    sourceCommit: "b76cb4514b9ab47f7db87901cb9b593b4adc3129",
    files: registryAdapted
      ? []
      : [
          {
            source: "apps/web/src/components/paid.tsx",
            destination: paidPath,
            sourceSha256: hash(paidSource),
            sha256: hash(paidSource),
            adapted: false,
          },
        ],
  });
  writeJson(join(root, "docs/template/saas-ui-registry-files.json"), {
    schemaVersion: 1,
    sourceCommit: "ac3a40c8dc05e403f9d501a87c092646891d3c40",
    files: registryAdapted
      ? [
          {
            source: "registry:fixture/paid.tsx",
            destination: paidPath,
            sourceSha256: hash("upstream paid source\n"),
            sha256: hash(paidSource),
            adapted: true,
          },
        ]
      : [],
  });
  return { root, lockSha256: hash(lock) };
};

const validate = (
  root: string,
  output: string,
  baselineValue: SaasUiTypecheckBaseline,
) =>
  assertSaasUiTypecheckDiagnostics(root, output, baselineValue, {
    artifactSafety: () => [],
    typescriptVersion: "5.9.3",
  });

describe("Saas UI receipt-aware typecheck", () => {
  it("accepts raw zero diagnostics with an environment-bound baseline", () => {
    const { root, lockSha256 } = fixture();
    try {
      expect(validate(root, "", baseline(lockSha256))).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("rejects a receipt-verified diagnostic even when it is baselined", () => {
    const { root, lockSha256 } = fixture();
    try {
      expect(
        validate(
          root,
          diagnostic("apps/web/src/components/paid.tsx"),
          baseline(lockSha256, 1),
        ),
      ).toEqual(
        expect.arrayContaining([
          "Saas UI raw TypeScript must report zero diagnostics",
          "Saas UI typecheck baseline must encode zero diagnostics",
        ]),
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("rejects dependency diagnostics instead of hiding them in the baseline", () => {
    const { root, lockSha256 } = fixture();
    try {
      expect(
        validate(
          root,
          diagnostic("node_modules/platform-specific/index.d.ts"),
          baseline(lockSha256),
        ),
      ).toContain("Saas UI raw TypeScript must report zero diagnostics");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("rejects a mutable diagnostic even when its identity is baselined", () => {
    const { root, lockSha256 } = fixture();
    try {
      const value = baseline(lockSha256, 1);
      expect(
        validate(root, diagnostic("apps/web/src/lib/mutable.ts"), value),
      ).toContain(
        "diagnostic path is not receipt-verified: apps/web/src/lib/mutable.ts",
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("rejects an adapted registry diagnostic", () => {
    const { root, lockSha256 } = fixture(true);
    try {
      expect(
        validate(
          root,
          diagnostic("apps/web/src/components/paid.tsx"),
          baseline(lockSha256, 1),
        ),
      ).toContain(
        "diagnostic path is not receipt-verified: apps/web/src/components/paid.tsx",
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("rejects diagnostic drift and lock drift", () => {
    const { root } = fixture();
    try {
      expect(
        validate(
          root,
          diagnostic("apps/web/src/components/paid.tsx"),
          baseline("0".repeat(64), 1),
        ),
      ).toContain("pnpm-lock.yaml hash does not match the diagnostic baseline");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("refuses to generate a nonzero release baseline", () => {
    const { root } = fixture();
    try {
      expect(() =>
        createSaasUiTypecheckBaseline(
          root,
          diagnostic("apps/web/src/components/paid.tsx"),
          "5.9.3",
        ),
      ).toThrow(/raw TypeScript has zero diagnostics/u);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
