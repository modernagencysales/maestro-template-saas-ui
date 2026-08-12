import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import { previewCommand } from "./golden-authority-command";
import {
  createGeneratedAuthorityMetadata,
  createReferenceAuthorityMetadata,
  assertDistinctAuthorities,
  serializeAuthorityMetadata,
} from "./golden-authority-runtime";

const starterPin = "b76cb4514b9ab47f7db87901cb9b593b4adc3129";

describe("golden runtime authority provenance", () => {
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
  });

  it("binds reference metadata to the pinned starter content digest", () => {
    const starterContentDigest = createHash("sha256")
      .update("pinned starter apps/web tree")
      .digest("hex");
    const metadata = createReferenceAuthorityMetadata({
      starterPin,
      starterContentDigest,
    });

    expect(metadata.provenance).toEqual({
      repository: "starter",
      commit: starterPin,
      path: "apps/web",
      contentDigest: starterContentDigest,
    });
    expect(metadata.digest).toBe(starterContentDigest);
    expect(metadata.digest).not.toBe(
      createHash("sha256").update(`reference:${starterPin}`).digest("hex"),
    );
  });

  it("proves generated metadata has a distinct materialized root and digest", () => {
    const reference = createReferenceAuthorityMetadata({
      starterPin,
      starterContentDigest: "a".repeat(64),
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
