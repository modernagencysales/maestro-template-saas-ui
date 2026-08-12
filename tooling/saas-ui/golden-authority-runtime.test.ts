import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { previewCommand } from "./golden-authority-command";
import {
  createGeneratedAuthorityMetadata,
  createReferenceAuthorityMetadata,
  assertDistinctAuthorities,
  proveReferenceServedFiles,
  serializeAuthorityMetadata,
  assertNoNewGoldenServerErrors,
  createGoldenServerErrorRecorder,
  readGoldenServerErrorEvents,
} from "./golden-authority-runtime";

const starterPin = "b76cb4514b9ab47f7db87901cb9b593b4adc3129";

describe("golden runtime authority provenance", () => {
  it("records only clear SSR exceptions and ignores benign warnings", () => {
    const root = mkdtempSync(join(tmpdir(), "golden-server-errors-"));
    try {
      const recorder = createGoldenServerErrorRecorder({
        evidenceRoot: root,
        authority: "reference",
      });
      recorder.recordChunk(
        "stderr",
        "Warning: Error in renderToReadableStream is recoverable\n",
      );
      recorder.recordChunk(
        "stderr",
        "Error in renderToReadableStream: /private/tmp/secret-paid-payload.json\n",
      );
      recorder.recordChunk(
        "stdout",
        "Uncaught ReferenceError: document is not defined\n",
      );
      recorder.close();

      const events = readGoldenServerErrorEvents({
        evidenceRoot: root,
        authority: "reference",
      });
      expect(events).toHaveLength(2);
      expect(events.map((event) => event.sequence)).toEqual([1, 2]);
      expect(events[0]).toMatchObject({
        authority: "reference",
        stream: "stderr",
        marker: "renderToReadableStream",
      });
      expect(events[1]).toMatchObject({
        authority: "reference",
        stream: "stdout",
        marker: "uncaught-error",
      });
      const serialized = readFileSync(
        join(root, "server-errors-reference.jsonl"),
        "utf8",
      );
      expect(serialized).not.toContain("/private/tmp");
      expect(serialized).not.toContain("secret-paid-payload");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("asserts server errors by per-authority sequence baseline", () => {
    const root = mkdtempSync(join(tmpdir(), "golden-server-errors-"));
    try {
      const recorder = createGoldenServerErrorRecorder({
        evidenceRoot: root,
        authority: "generated",
      });
      const baseline = recorder.baseline();
      recorder.recordChunk("stderr", "Uncaught TypeError: broken\n");
      recorder.close();
      expect(() =>
        assertNoNewGoldenServerErrors({
          evidenceRoot: root,
          authority: "generated",
          baseline,
        }),
      ).toThrow("generated server runtime errors");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("uses distinct loopback authorities for reference and generated previews", () => {
    const reference = previewCommand({
      repositoryRoot: "/workspace/factory",
      targetRoot: "/tmp/generated",
      authority: "reference",
      port: "4173",
    });
    const generated = previewCommand({
      repositoryRoot: "/workspace/factory",
      targetRoot: "/tmp/generated",
      authority: "generated",
      port: "4174",
    });

    const referenceUrl = new URL(`http://127.0.0.1:${reference.args.at(-1)}`);
    const generatedUrl = new URL(`http://127.0.0.1:${generated.args.at(-1)}`);

    expect(referenceUrl.hostname).toBe("127.0.0.1");
    expect(generatedUrl.hostname).toBe("127.0.0.1");
    expect(referenceUrl.origin).not.toBe(generatedUrl.origin);
    expect(reference.cwd).toBe("/workspace/factory/apps/web");
    expect(generated.cwd).toBe("/tmp/generated/apps/web");
  });

  it("binds reference metadata to the pinned starter content digest", () => {
    const starterContentDigest = createHash("sha256")
      .update("pinned starter apps/web tree")
      .digest("hex");
    const servedContentDigest = createHash("sha256")
      .update("served factory apps/web files")
      .digest("hex");
    const metadata = createReferenceAuthorityMetadata({
      starterPin,
      starterContentDigest,
      servedContentDigest,
      receiptDigest: "a".repeat(64),
      receiptPath: "docs/template/saas-ui-starter-files.json",
      mappedFileCount: 1,
      adaptedFileCount: 1,
    });

    expect(metadata.provenance).toMatchObject({
      repository: "starter",
      commit: starterPin,
      path: "apps/web",
      contentDigest: servedContentDigest,
      sourceContentDigest: starterContentDigest,
      receiptPath: "docs/template/saas-ui-starter-files.json",
      receiptDigest: "a".repeat(64),
      mappedFileCount: 1,
      adaptedFileCount: 1,
    });
    expect(metadata.digest).toBe(servedContentDigest);
    expect(metadata.digest).not.toBe(
      createHash("sha256").update(`reference:${starterPin}`).digest("hex"),
    );
  });

  it("rejects a modified served factory file while the starter source is unchanged", () => {
    const original = Buffer.from("pinned starter content\n");
    const served = Buffer.from("modified factory content\n");
    const sourceSha256 = createHash("sha256").update(original).digest("hex");

    expect(() =>
      proveReferenceServedFiles({
        starterPin,
        starterContentDigest: "a".repeat(64),
        receiptDigest: "b".repeat(64),
        receiptPath: "docs/template/saas-ui-starter-files.json",
        files: [
          {
            destination: "apps/web/src/features/common/layouts/app-layout.tsx",
            content: served,
            sourceSha256,
            sha256: sourceSha256,
            adapted: false,
          },
        ],
      }),
    ).toThrow(
      "Reference served file hash mismatch: apps/web/src/features/common/layouts/app-layout.tsx",
    );
  });

  it("proves generated metadata has a distinct materialized root and digest", () => {
    const reference = createReferenceAuthorityMetadata({
      starterPin,
      starterContentDigest: "a".repeat(64),
      servedContentDigest: "a".repeat(64),
      receiptDigest: "a".repeat(64),
      receiptPath: "docs/template/saas-ui-starter-files.json",
      mappedFileCount: 1,
      adaptedFileCount: 0,
    });
    const generated = createGeneratedAuthorityMetadata({
      generatedDigest: "b".repeat(64),
    });

    expect(generated.root).toBe("materialized-generated-target");
    expect(generated.digest).toBe("b".repeat(64));
    expect(generated.provenance).toMatchObject({
      repository: "generated-target",
      source: "buildSaasApplicationTargetPlan",
      contentDigest: "b".repeat(64),
    });
    expect(() => assertDistinctAuthorities(reference, generated)).not.toThrow();
  });

  it("serializes only repository-safe authority metadata", () => {
    const metadata = createGeneratedAuthorityMetadata({
      generatedDigest: "c".repeat(64),
    });

    const serialized = serializeAuthorityMetadata(metadata);

    expect(serialized).not.toMatch(/\/(?:Users|var\/folders|tmp)\//u);
    expect(serialized).not.toContain("GOLDEN_GENERATED_URL");
  });
});
