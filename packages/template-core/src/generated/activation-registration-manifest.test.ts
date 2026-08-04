import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("activation registration manifest", () => {
  it("records the checked-in empty activation inventory", async () => {
    const manifest = JSON.parse(
      await readFile(
        resolve(import.meta.dirname, "activation-registration-manifest.json"),
        "utf8",
      ),
    );

    expect(manifest).toEqual({ schemaVersion: 1, registrations: [] });
  });
});
