import { describe, expect, it } from "vitest";

import refs from "../confect/_generated/refs";

describe("access provisioning Confect ref", () => {
  it("declares an ensureProvisioned mutation for the web quickstart path", () => {
    expect(refs.public.access.provisioning.ensureProvisioned).toMatchObject({
      functionNamespace: "access/provisioning",
      functionSpec: {
        name: "ensureProvisioned",
        functionVisibility: "public",
      },
    });
  });
});
