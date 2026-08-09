import { describe, expect, it } from "vitest";

import {
  defineDiagnosticRegistryProjection,
  projectGateDiagnostic,
  validateDiagnosticDescriptor,
  type DiagnosticDescriptor,
} from "./diagnostics.js";

const descriptor: DiagnosticDescriptor = {
  gateId: "workflow-semantics",
  posture: "required",
  evidenceClass: "behavioral",
  canonicalDoc: "docs/template/generated/workflow-semantics.md",
  repairHint: "Fix the reported workflow invariant in the owning source file.",
  argv: ["pnpm", "check:workflow:fast"],
  rerun: ["pnpm", "check:workflow:fast"],
  focusedPathPrefixes: ["packages/convex/confect/workflows/"],
  defaultFocused: true,
  semanticRuleIds: ["workflow/no-raw-runner"],
};

describe("diagnostic registry projection", () => {
  it("preserves canonical registry evidence and semantic rule ids", () => {
    const [registered] = defineDiagnosticRegistryProjection([descriptor]);
    if (registered === undefined) {
      throw new Error("Expected the diagnostic fixture to be registered.");
    }
    const projected = projectGateDiagnostic(registered, {
      status: "fail",
      message: "A workflow node bypasses the generated runner.",
      semanticRuleIds: ["workflow/no-raw-runner"],
    });

    expect(projected).toMatchObject({
      code: "workflow-semantics",
      severity: "error",
      safeToContinue: false,
      gateId: "workflow-semantics",
      posture: "required",
      evidenceClass: "behavioral",
      canonicalDoc: descriptor.canonicalDoc,
      repairHint: descriptor.repairHint,
      rerunArgv: ["pnpm", "check:workflow:fast"],
      semanticRuleIds: ["workflow/no-raw-runner"],
    });
    expect(projected.rerun).toBe("pnpm check:workflow:fast");
  });

  it.each([
    "Edit the gate until it passes.",
    "Disable this gate temporarily.",
    "Skip the failing check.",
    "Weaken the gate threshold.",
  ])("rejects unsafe repair advice: %s", (repairHint) => {
    expect(validateDiagnosticDescriptor({ ...descriptor, repairHint })).toEqual(
      {
        ok: false,
        reason:
          "repairHint must repair the invariant, never edit, disable, skip, or weaken a gate",
      },
    );
  });

  it.each([
    ["bash", "-lc", "pnpm test"],
    ["bash", "-lc", "true"],
    ["dash", "-c", "id"],
    ["cmd", "/c", "id"],
    ["powershell", "-Command", "id"],
    ["pwsh", "-Command", "id"],
    ["python", "-c", "id"],
    ["just", "verify"],
    ["pnpm", "test"],
    ["pnpm", "exec", "vitest"],
    ["pnpm", "check:*"],
  ])("rejects unbounded or shell-capable argv: %j", (...argv) => {
    expect(
      validateDiagnosticDescriptor({ ...descriptor, argv, rerun: argv }),
    ).toMatchObject({ ok: false });
  });

  it("accepts direct executable and pnpm --dir command identities", () => {
    expect(
      validateDiagnosticDescriptor({
        ...descriptor,
        argv: ["gitleaks", "detect", "--redact"],
        rerun: ["gitleaks", "detect", "--redact"],
      }),
    ).toEqual({ ok: true });
    expect(
      validateDiagnosticDescriptor({
        ...descriptor,
        argv: ["pnpm", "--dir", "tooling/agent-pack", "test"],
        rerun: ["pnpm", "--dir", "tooling/agent-pack", "test"],
      }),
    ).toEqual({ ok: true });
  });

  it("rejects duplicate registry gate ids rather than owning another gate list", () => {
    expect(() =>
      defineDiagnosticRegistryProjection([descriptor, descriptor]),
    ).toThrow(/duplicate diagnostic gate id/i);
  });

  it("rejects malformed semantic rule ids", () => {
    expect(
      validateDiagnosticDescriptor({
        ...descriptor,
        semanticRuleIds: ["workflow rule with spaces"],
      }),
    ).toEqual({
      ok: false,
      reason: "semantic rule ids must be stable, path-safe identifiers",
    });
  });

  it("projects advisory failures as non-blocking warnings", () => {
    const projected = projectGateDiagnostic(
      { ...descriptor, gateId: "taste", posture: "advisory" },
      { status: "fail", message: "Review suggested." },
    );
    expect(projected).toMatchObject({
      severity: "warning",
      safeToContinue: true,
    });
  });
});
