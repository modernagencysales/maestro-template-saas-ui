import { describe, expect, it } from "vitest";

import { api } from "./react";

describe("generated fake tRPC facade", () => {
  it("serves nested query procedures used by projected SaaS UI screens", () => {
    expect(api.contacts.listByType.useQuery({})).toMatchObject({
      isLoading: false,
      isPending: false,
    });
    expect(api.notifications.inbox.useQuery({})).toMatchObject({
      isLoading: false,
      isPending: false,
    });
  });
});
