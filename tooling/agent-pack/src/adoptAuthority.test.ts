import { describe, expect, it } from "vitest";
import {
  validateAdoptionAuthority,
  type AdoptionAuthorityInput,
} from "./adoptAuthority.js";
const sourceRevision = "1".repeat(40);
const targetRevision = "2".repeat(40);
const templateRevision = "3".repeat(40);

const baseInput = (): AdoptionAuthorityInput => ({
  mode: "separate-target",
  sourceReadOnly: true,
  source: {
    requestedRoot: "/work/existing-app",
    resolvedRoot: "/work/existing-app",
    worktreeRoot: "/work/existing-app",
    exists: true,
    empty: false,
    clean: true,
    revision: sourceRevision,
  },
  target: {
    requestedRoot: "/work/customer-app",
    resolvedRoot: "/work/customer-app",
    worktreeRoot: null,
    exists: false,
    empty: null,
    clean: null,
    revision: null,
  },
  baseline: {
    sourceRevision,
    targetRevision: null,
  },
  template: {
    requestedRoot: "/releases/maestro-v1",
    resolvedRoot: "/releases/maestro-v1",
    tag: "maestro-template-v1",
    commit: templateRevision,
    archiveChecksum: `sha256:${"a".repeat(64)}`,
    manifestChecksum: `sha256:${"b".repeat(64)}`,
  },
  reviewedTemplate: {
    tag: "maestro-template-v1",
    commit: templateRevision,
    archiveChecksum: `sha256:${"a".repeat(64)}`,
    manifestChecksum: `sha256:${"b".repeat(64)}`,
  },
  protectedRoots: [
    { label: "factory", resolvedRoot: "/factory" },
    { label: "home", resolvedRoot: "/home/operator" },
  ],
});

describe("adoption launch authority", () => {
  it("accepts a disjoint absent target with exact immutable authority", () => {
    const input = baseInput();
    const before = structuredClone(input);
    const first = validateAdoptionAuthority(input);
    const second = validateAdoptionAuthority(input);

    expect(first).toEqual(second);
    expect(first).toMatchObject({
      ok: true,
      mutationPosture: "read-only",
      findings: [],
      authorityFingerprint: expect.stringMatching(/^sha256:[a-f0-9]{64}$/),
    });
    expect(input).toEqual(before);
  });

  it.each([
    [
      "dirty source",
      { source: { clean: false } },
      "ADOPTION_AUTHORITY_SOURCE_DIRTY",
    ],
    [
      "symbolic source revision",
      { source: { revision: "HEAD" }, baseline: { sourceRevision: "HEAD" } },
      "ADOPTION_AUTHORITY_SOURCE_STALE",
    ],
    [
      "symbolic template revision",
      {
        template: { commit: "template-main" },
        reviewedTemplate: { commit: "template-main" },
      },
      "ADOPTION_AUTHORITY_TEMPLATE_MISMATCH",
    ],
  ])("rejects %s authority", (_name, patch, code) => {
    const input = baseInput();
    const candidate = {
      ...input,
      source: { ...input.source, ...patch.source },
      baseline: { ...input.baseline, ...patch.baseline },
      template: { ...input.template, ...patch.template },
      reviewedTemplate: {
        ...input.reviewedTemplate,
        ...patch.reviewedTemplate,
      },
    };
    expect(validateAdoptionAuthority(candidate)).toMatchObject({
      ok: false,
      findings: expect.arrayContaining([expect.objectContaining({ code })]),
    });
  });

  it.each([
    ["equal", "/work/existing-app"],
    ["target nested in source", "/work/existing-app/customer"],
    ["target contains source", "/work"],
  ])("rejects %s roots symmetrically", (_name, targetRoot) => {
    const input = baseInput();
    const target = {
      ...input.target,
      requestedRoot: targetRoot,
      resolvedRoot: targetRoot,
    };

    expect(validateAdoptionAuthority({ ...input, target })).toMatchObject({
      ok: false,
      findings: expect.arrayContaining([
        expect.objectContaining({ code: "ADOPTION_AUTHORITY_ROOT_OVERLAP" }),
      ]),
      authorityFingerprint: null,
    });
  });

  it("rejects a prospective target resolving through a protected symlink", () => {
    const input = baseInput();
    const target = {
      ...input.target,
      requestedRoot: "/work/customer-link/app",
      resolvedRoot: "/factory/customer/app",
    };

    expect(validateAdoptionAuthority({ ...input, target })).toMatchObject({
      ok: false,
      findings: expect.arrayContaining([
        expect.objectContaining({
          code: "ADOPTION_AUTHORITY_PROTECTED_ROOT",
        }),
      ]),
    });
  });

  it("rejects protected roots in both containment directions", () => {
    const input = baseInput();
    const protectedRoots = [
      { label: "nested factory", resolvedRoot: "/work/customer-app/factory" },
    ];

    expect(
      validateAdoptionAuthority({ ...input, protectedRoots }),
    ).toMatchObject({
      ok: false,
      findings: expect.arrayContaining([
        expect.objectContaining({
          code: "ADOPTION_AUTHORITY_PROTECTED_ROOT",
        }),
      ]),
    });
  });
  it("rejects an in-place mutation root inside a protected root", () => {
    const input = baseInput();
    const shared = { ...input.source };
    expect(
      validateAdoptionAuthority({
        ...input,
        mode: "in-place",
        target: shared,
        baseline: {
          sourceRevision,
          targetRevision: sourceRevision,
        },
        protectedRoots: [
          { label: "factory", resolvedRoot: "/work/existing-app" },
        ],
      }),
    ).toMatchObject({
      ok: false,
      findings: expect.arrayContaining([
        expect.objectContaining({
          code: "ADOPTION_AUTHORITY_PROTECTED_ROOT",
        }),
      ]),
    });
  });

  it("keeps the immutable template release disjoint from source and target", () => {
    const input = baseInput();
    const template = {
      ...input.template,
      requestedRoot: "/work/customer-app/release",
      resolvedRoot: "/work/customer-app/release",
    };

    expect(validateAdoptionAuthority({ ...input, template })).toMatchObject({
      ok: false,
      findings: expect.arrayContaining([
        expect.objectContaining({
          code: "ADOPTION_AUTHORITY_TEMPLATE_OVERLAP",
        }),
      ]),
    });
  });

  it("rejects stale source and target baseline revisions", () => {
    const input = baseInput();
    const target = {
      ...input.target,
      worktreeRoot: input.target.resolvedRoot,
      exists: true,
      empty: true,
      clean: true,
      revision: targetRevision,
    };

    expect(
      validateAdoptionAuthority({
        ...input,
        source: { ...input.source, revision: "4".repeat(40) },
        target,
        baseline: {
          sourceRevision,
          targetRevision: "5".repeat(40),
        },
      }),
    ).toMatchObject({
      ok: false,
      findings: expect.arrayContaining([
        expect.objectContaining({ code: "ADOPTION_AUTHORITY_SOURCE_STALE" }),
        expect.objectContaining({ code: "ADOPTION_AUTHORITY_TARGET_STALE" }),
      ]),
    });
  });

  it("rejects a nonempty, dirty, or ambiguously probed existing target", () => {
    const input = baseInput();
    const target = {
      ...input.target,
      exists: true,
      empty: false,
      clean: false,
      revision: targetRevision,
      worktreeRoot: null,
    };

    expect(validateAdoptionAuthority({ ...input, target })).toMatchObject({
      ok: false,
      findings: expect.arrayContaining([
        expect.objectContaining({
          code: "ADOPTION_AUTHORITY_TARGET_NOT_EMPTY",
        }),
        expect.objectContaining({ code: "ADOPTION_AUTHORITY_TARGET_DIRTY" }),
        expect.objectContaining({
          code: "ADOPTION_AUTHORITY_WORKTREE_INVALID",
        }),
      ]),
    });
  });

  it.each(["commit", "archiveChecksum", "manifestChecksum"] as const)(
    "rejects a mismatched immutable template %s",
    (field) => {
      const input = baseInput();
      const template = { ...input.template, [field]: "mismatch" };

      expect(validateAdoptionAuthority({ ...input, template })).toMatchObject({
        ok: false,
        findings: expect.arrayContaining([
          expect.objectContaining({
            code: "ADOPTION_AUTHORITY_TEMPLATE_MISMATCH",
          }),
        ]),
      });
    },
  );

  it("accepts only exact clean in-place launch identity", () => {
    const input = baseInput();
    const target = { ...input.source };
    const accepted = validateAdoptionAuthority({
      ...input,
      mode: "in-place",
      target,
      baseline: {
        sourceRevision,
        targetRevision: sourceRevision,
      },
    });
    const rejected = validateAdoptionAuthority({
      ...input,
      mode: "in-place",
      target: { ...target, clean: false },
      baseline: {
        sourceRevision,
        targetRevision: sourceRevision,
      },
    });

    expect(accepted.ok).toBe(true);
    expect(rejected).toMatchObject({
      ok: false,
      findings: expect.arrayContaining([
        expect.objectContaining({ code: "ADOPTION_AUTHORITY_IN_PLACE_UNSAFE" }),
      ]),
    });
  });
});
