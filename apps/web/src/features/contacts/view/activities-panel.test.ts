import { describe, expect, it } from "vitest";

import { toTimelineActivity } from "./activities-panel";

const base = {
  id: "activity_1",
  actorId: null,
  actorType: "user",
  createdAt: new Date(0),
  updatedAt: new Date(0),
};

describe("toTimelineActivity", () => {
  it("maps persisted activity names into the Starter timeline union", () => {
    expect(
      toTimelineActivity({
        ...base,
        type: "comment-added",
        metadata: { comment: "Hello" },
      }),
    ).toMatchObject({
      type: "comment",
      data: { comment: "Hello" },
      user: { id: "system" },
    });

    expect(
      toTimelineActivity({
        ...base,
        type: "contact-updated",
        metadata: { field: "status", value: "active" },
      }),
    ).toMatchObject({
      type: "update",
      data: { field: "status", value: "active" },
    });
  });
});
