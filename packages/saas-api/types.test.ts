import { readFileSync } from "node:fs";

import { describe, expect, expectTypeOf, it } from "vitest";

import type {
  ContactDTO,
  NotificationDTO,
  TagDTO,
  UserDTO,
  WorkspaceDTO,
  WorkspaceMemberDTO,
  WorkspaceMemberSettingsDTO,
} from "./types";

describe("Starter API type facade", () => {
  it("does not erase imported screen contracts with any", () => {
    const source = readFileSync(new URL("./types.ts", import.meta.url), "utf8");

    expect(source).not.toMatch(/=\s*any\s*;/);
  });

  it("keeps the imported Starter screen DTO fields explicit", () => {
    expectTypeOf<ContactDTO>().toHaveProperty("workspaceId");
    expectTypeOf<ContactDTO>().toHaveProperty("tags");
    expectTypeOf<NotificationDTO>().toHaveProperty("metadata");
    expectTypeOf<NotificationDTO>().toHaveProperty("subject");
    expectTypeOf<TagDTO>().toHaveProperty("color");
    expectTypeOf<UserDTO>().toHaveProperty("avatar");
    expectTypeOf<WorkspaceDTO>().toHaveProperty("subscription");
    expectTypeOf<WorkspaceDTO>().toHaveProperty("members");
    expectTypeOf<WorkspaceMemberDTO>().toHaveProperty("presence");
    expectTypeOf<WorkspaceMemberSettingsDTO>().toHaveProperty("channels");
    expectTypeOf<WorkspaceMemberSettingsDTO>().toHaveProperty("topics");
    expectTypeOf<WorkspaceMemberSettingsDTO>().toHaveProperty("newsletters");
  });
});
