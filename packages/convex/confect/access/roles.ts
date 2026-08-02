import * as Schema from "effect/Schema";

export const Role = Schema.Literals(["viewer", "editor", "admin", "owner"]);

export type Role = Schema.Schema.Type<typeof Role>;

const roleRank: Readonly<Record<Role, number>> = {
  viewer: 0,
  editor: 1,
  admin: 2,
  owner: 3,
};

export const roleAtLeast = (actual: Role, required: Role): boolean =>
  roleRank[actual] >= roleRank[required];

export const capRole = (role: Role, maximum: Role): Role =>
  roleRank[role] <= roleRank[maximum] ? role : maximum;

export const highestRole = (roles: readonly Role[]): Role | undefined =>
  roles.reduce<Role | undefined>(
    (highest, role) =>
      !highest || roleRank[role] > roleRank[highest] ? role : highest,
    undefined,
  );
