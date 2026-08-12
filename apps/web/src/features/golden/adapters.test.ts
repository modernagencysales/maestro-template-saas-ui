// @vitest-environment jsdom

import { describe, expect, it } from "vitest";

import { createGoldenAdapter } from "./adapters";

function installStorage() {
  const values = new Map<string, string>();
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: {
      clear: () => values.clear(),
      getItem: (key: string) => values.get(key) ?? null,
      removeItem: (key: string) => values.delete(key),
      setItem: (key: string, value: string) => values.set(key, value),
    },
  });
}

describe("golden adapter contact mutations", () => {
  it("hydrates a later adapter from persisted mutation state", async () => {
    installStorage();
    window.localStorage.clear();
    const firstAdapter = createGoldenAdapter();

    await firstAdapter.updateContactStatus("contact-1", "inactive");

    const secondAdapter = createGoldenAdapter();
    expect(
      secondAdapter.contacts.find(({ id }) => id === "contact-1"),
    ).toMatchObject({ id: "contact-1", status: "inactive" });
    window.localStorage.clear();
  });

  it("updates the exact contact in its authoritative snapshot and notifies subscribers", async () => {
    installStorage();
    window.localStorage.clear();
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
