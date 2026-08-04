import { describe, expect, it } from "vitest";

import { issuerBoundTokenIdentifier } from "../convex/httpAuthorization";

describe("issuer-bound user identity migration", () => {
  it("keeps identical subjects from different issuers distinct", () => {
    expect(
      issuerBoundTokenIdentifier("https://issuer-a.example", "same"),
    ).not.toBe(issuerBoundTokenIdentifier("https://issuer-b.example", "same"));
  });

  it("rejects a bare subject and blank authority parts", () => {
    expect(() => issuerBoundTokenIdentifier("", "same")).toThrow(/issuer/u);
    expect(() =>
      issuerBoundTokenIdentifier("https://issuer.example", ""),
    ).toThrow(/subject/u);
  });
});
