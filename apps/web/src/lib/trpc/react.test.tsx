import { describe, expect, it } from "vitest";

import { api } from "./react";

describe("generated fake tRPC facade", () => {
  it("serves the shared neutral fixtures required by projected SaaS UI screens", async () => {
    const contacts = api.contacts.listByType.useQuery({});
    expect(contacts).toMatchObject({
      isLoading: false,
      isPending: false,
    });
    expect(contacts.data.contacts[0]).toMatchObject({
      id: "contact-1",
      name: "Jordan Lee",
    });
    expect(api.contacts.byId.useSuspenseQuery({})[0]).toMatchObject({
      id: "contact-1",
      name: "Jordan Lee",
    });
    expect(
      api.contacts.byId.useSuspenseQuery({ id: "contact-2" })[0],
    ).toMatchObject({
      id: "contact-2",
      name: "Sam Rivera",
    });
    expect(api.notifications.inbox.useQuery({})).toMatchObject({
      data: {
        notifications: expect.arrayContaining([
          expect.objectContaining({ subject: { name: "Jordan Lee" } }),
        ]),
      },
      isLoading: false,
      isPending: false,
    });
    expect(api.notifications.inbox.useQuery({})).toBe(
      api.notifications.inbox.useQuery({}),
    );
    expect(api.billing.account.useQuery({})).toMatchObject({
      data: { email: "alex@example.com" },
    });
    expect(api.billing.listInvoices.useSuspenseQuery({})[0]).toEqual([
      expect.objectContaining({ number: "INV-001", status: "paid" }),
    ]);
    await expect(
      api.workspaces.create.useMutation().mutateAsync({}),
    ).resolves.toEqual({ slug: "acme" });
    await expect(
      api.workspaces.slugAvailable.useMutation().mutateAsync({}),
    ).resolves.toEqual({ available: true });
  });
});
