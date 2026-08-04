import { describe, expect, it } from "vitest";
import * as Schema from "effect/Schema";

import { RequiredUserRow, UserRow } from "../confect/access/tenancySchemas";
import { issuerBoundTokenIdentifier } from "../confect/httpAuthorization";

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

  it("keeps the deployed row optional until the final required-field step", () => {
    const legacy = {
      subject: "legacy-subject",
      email: "legacy@example.com",
      status: "active",
      createdAt: 1,
      updatedAt: 1,
    } as const;

    expect(Schema.decodeUnknownSync(UserRow)(legacy)).toEqual(legacy);
    expect(() => Schema.decodeUnknownSync(RequiredUserRow)(legacy)).toThrow();
  });
});
