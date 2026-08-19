import { z } from 'zod'

import { db, eq, userProfiles, users } from '@workspace/db'

import {
  UpdateUserProfileSchema,
  UserDTO,
  UserProfileDTO,
} from './users.schema'

export const userById = async (id: string) => {
  const user = await db.query.users.findFirst({
    where: { id },
    columns: {
      id: true,
      email: true,
      image: true,
      name: true,
      createdAt: true,
      updatedAt: true,
    },
    with: {
      userProfile: {
        columns: {
          locale: true,
        },
      },
      memberships: {
        with: {
          workspace: {
            columns: {
              id: true,
              name: true,
              slug: true,
              logo: true,
            },
          },
        },
      },
    },
  })

  if (!user) {
    return null
  }

  return {
    ...user,
    workspaces: user.memberships.map((m) => m.workspace),
  }
}

export const userProfileById = async (id: string) => {
  return await db.query.userProfiles.findFirst({
    where: { id },
    columns: {
      locale: true,
    },
  })
}

export const createUserProfile = async (input: UserProfileDTO) => {
  const result = await db
    .insert(userProfiles)
    .values(input)
    .onConflictDoNothing()
    .returning({
      insertedId: userProfiles.id,
    })
    .execute()

  const id = result[0]?.insertedId

  return id ? userProfileById(id) : null
}

export const updateUserProfileById = async (
  input: z.infer<typeof UpdateUserProfileSchema>,
) => {
  const { id, locale } = input
  const result = await db
    .update(userProfiles)
    .set({
      locale,
    })
    .where(eq(userProfiles.id, id))
    .returning({
      id: userProfiles.id,
    })

  return result[0]
}

export const updateUserById = async (input: UserDTO) => {
  const result = await db
    .update(users)
    .set({
      name: input.name,
      // TODO: validate email
      email: input.email,
      image: input.avatar,
    })
    .where(eq(users.id, input.id))
    .returning({
      id: users.id,
    })

  return result[0]
}
