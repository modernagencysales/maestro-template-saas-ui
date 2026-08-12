import { describe, expect, it } from "vitest";

import { createGoldenAdapter } from "./adapters";

describe("golden adapter contact mutations", () => {
  it("updates the exact contact in its authoritative snapshot and notifies subscribers", async () => {
    const adapter = createGoldenAdapter();
    const untouchedContact = adapter.contacts.find(
      ({ id }) => id === "contact-2",
    );
    let notifications = 0;
    const unsubscribe = adapter.subscribe(() => {
      notifications += 1;
    });

    await adapter.updateContactStatus("contact-1", "inactive");

    expect(notifications).toBe(1);
    expect(adapter.contacts.find(({ id }) => id === "contact-1")).toMatchObject(
      { id: "contact-1", name: "Jordan Lee", status: "inactive" },
    );
    expect(adapter.contacts.find(({ id }) => id === "contact-2")).toBe(
      untouchedContact,
    );

    unsubscribe();
  });
});
