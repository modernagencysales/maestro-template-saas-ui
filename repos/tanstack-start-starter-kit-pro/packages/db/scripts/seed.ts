// sort-imports-ignore
import * as dotenv from 'dotenv'
dotenv.config({ path: ['../.env', '../.env.local'] })

import { eq } from 'drizzle-orm'
import { reset, seed } from 'drizzle-seed'
import crypto from 'node:crypto'

import * as authSqlSchema from '../src/auth/auth.sql.ts'
import * as schema from '../src/index.ts'
import { auth } from '../../better-auth/src/auth.ts'
import { plans as billingPlans } from '../../config/billing.config'
import { DEFAULT_WORKSPACE_TAGS } from '../../config/constants.ts'
import { db } from '../src/db.ts'
import { createId } from '../src/utils.ts'

const workspaceId = 'qlrjw77z2f047s4k08gfb4e2'

async function runSeed() {
  console.log('\n🌱 Starting Database Seed Process')
  console.log('---------------------------------------')

  // --- 1. Define Test User Credentials ---
  const testEmail = process.argv.includes('--email')
    ? process.argv[process.argv.indexOf('--email') + 1]
    : 'demo@saas-ui.dev'

  const testPassword = process.argv.includes('--password')
    ? process.argv[process.argv.indexOf('--password') + 1]
    : crypto.randomBytes(16).toString('hex')

  const testName = 'Demo User'

  // --- 2. Reset Database (Truncate Tables) ---
  const shouldReset = process.argv.includes('--reset')

  if (shouldReset) {
    await reset(db, {
      // App tables
      activityLogs: schema.activityLogs,
      billingAccounts: schema.billingAccounts,
      billingPlans: schema.billingPlans,
      billingSubscriptions: schema.billingSubscriptions,
      contacts: schema.contacts,
      notifications: schema.notifications,
      tags: schema.tags,
      workspaceMembers: schema.workspaceMembers,
      workspaces: schema.workspaces,
      users: schema.users,
      // Auth tables
      authUsers: authSqlSchema.users,
      authAccounts: authSqlSchema.accounts,
      authSessions: authSqlSchema.sessions,
      authVerifications: authSqlSchema.verifications,
    })
    console.log('✅ Database tables reset successfully.')
  } else {
    console.log('ℹ️ Skipping database reset as --reset flag was not provided.')
  }

  // --- 3. Create Owner User (App User, Auth User, Auth Account) ---
  const userId = createId()

  // 3a. Create Application User
  const appUserToCreate = {
    id: userId,
    email: testEmail,
    name: testName,
    createdAt: new Date(),
    updatedAt: new Date(),
    // Add any other required fields for your app's 'users' table
  }
  await db.insert(schema.users).values(appUserToCreate)
  console.log(`✅ Application user '${testName}' created (ID: ${userId})`)

  // Assign to ownerUser for subsequent script parts
  const ownerUser = { ...appUserToCreate } // Ensure ownerUser has the needed fields (id, name, email)

  // 3b. Create Auth User (for better-auth)
  const authUserToCreate = {
    id: userId,
    email: testEmail,
    name: testName,
    emailVerified: true,
    image: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
  await db.insert(authSqlSchema.users).values(authUserToCreate)
  console.log(
    `✅ Auth user for better-auth '${testName}' created (ID: ${userId})`,
  )

  // 3c. Create Auth Account (credential for better-auth)
  const authContext = await auth.$context
  const hashedPassword = await authContext.password.hash(testPassword)

  const authAccountToCreate = {
    userId: userId,
    providerId: 'credential',
    accountId: testEmail,
    password: hashedPassword,
    createdAt: new Date(),
    updatedAt: new Date(),
    refreshToken: null,
    accessToken: null,
    accessTokenExpiresAt: null,
    refreshTokenExpiresAt: null,
    scope: null,
    idToken: null,
  }
  await db.insert(authSqlSchema.accounts).values(authAccountToCreate)
  console.log(`✅ Auth account (credential) for user '${testEmail}' created.`)

  // --- 4. Create Workspace (1) ---
  const workspaceName = 'Awesome Inc.'
  const workspaceSlug = workspaceName
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
  const workspaceValue = {
    id: workspaceId,
    ownerId: ownerUser.id,
    name: workspaceName,
    slug: workspaceSlug,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
  const [createdWorkspace] = await db
    .insert(schema.workspaces)
    .values(workspaceValue)
    .returning({ id: schema.workspaces.id, name: schema.workspaces.name })
  console.log(
    `✅ Workspace '${createdWorkspace.name}' created (ID: ${createdWorkspace.id}) for owner ${ownerUser.email}.`,
  )

  // --- 5. Create Workspace Member (Owner Only) ---
  const memberValue = {
    userId: ownerUser.id,
    workspaceId: createdWorkspace.id,
    role: 'admin' as const,
    status: 'active' as const,
    invitedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
  await db.insert(schema.workspaceMembers).values(memberValue)
  console.log(
    `✅ Owner '${ownerUser.email}' added to workspace '${createdWorkspace.name}' successfully.`,
  )

  // --- 6. Create Contacts (200) - Using drizzle-seed ---
  const contactStatuses = [
    'new' as const,
    'active' as const,
    'inactive' as const,
  ]
  const contactTypes = ['lead' as const, 'customer' as const]

  await seed(db, { contacts: schema.contacts }).refine((f) => ({
    contacts: {
      count: 200,
      columns: {
        id: f.valuesFromArray({
          isUnique: true,
          values: Array.from({ length: 200 }, () => createId()),
        }),
        workspaceId: f.default({ defaultValue: createdWorkspace.id }),
        email: f.email(),
        firstName: f.firstName(),
        lastName: f.lastName(),
        name: f.fullName(),
        status: f.valuesFromArray({ values: contactStatuses }),
        avatar: f.valuesFromArray({
          values: Array.from(
            { length: 200 },
            () =>
              `https://xsgames.co/randomusers/avatar.php?g=${f.valuesFromArray({
                values: ['male', 'female', 'pixel'],
              })}&name=${f.fullName()}`,
          ),
        }),
        type: f.valuesFromArray({ values: contactTypes }),
        tags: f.default({ defaultValue: [] }),
        createdAt: f.date({
          minDate: new Date('2025-01-01'),
          maxDate: new Date(),
        }),
        updatedAt: f.date({
          minDate: new Date('2025-01-01'),
          maxDate: new Date(),
        }),
      },
    },
  }))
  console.log('✅ 200 contacts created using drizzle-seed.')

  // --- 7. Create Billing Plans ---
  const planValues = billingPlans.map((plan) => ({
    id: plan.id,
    name: plan.name,
    description: plan.description,
    price: plan.features.find((f) => f.id === 'users')?.price ?? 0,
    currency: plan.currency,
    interval: plan.interval,
    active: plan.active,
    trialPeriodDays: plan.trialDays,
    createdAt: new Date(),
    updatedAt: new Date(),
  }))
  const createdBillingPlans = await db
    .insert(schema.billingPlans)
    .values(planValues)
    .returning()
  console.log(`✅ ${planValues.length} billing plans created.`)

  // --- 8. Create Billing Account (1) for the Workspace ---
  // Manual creation.
  const billingAccountValue = {
    id: createdWorkspace.id, // Using workspaceId as billingAccountId
    customerId: `cus_${createdWorkspace.id}`,
    email: ownerUser.email,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
  await db.insert(schema.billingAccounts).values(billingAccountValue)
  console.log(
    `✅ Billing account for workspace '${createdWorkspace.name}' created.`,
  )

  // --- 9. Create Billing Subscription (1) ---
  // Manual creation.
  const subscriptionEndDate = new Date()
  subscriptionEndDate.setMonth(subscriptionEndDate.getMonth() + 1) // For monthly plan

  // Find the free monthly plan for initial subscription
  const freePlan =
    createdBillingPlans.find(
      (plan) => plan.price === 0 && plan.interval === 'month',
    ) ?? createdBillingPlans[0]

  const subscriptionValue = {
    id: `sub_${createdWorkspace.id}`,
    accountId: createdWorkspace.id,
    planId: freePlan.id, // Subscribe to the free plan by default
    status: 'active' as const,
    quantity: 1,
    startedAt: new Date(),
    currentPeriodStart: new Date(),
    currentPeriodEnd: subscriptionEndDate,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
  await db.insert(schema.billingSubscriptions).values(subscriptionValue)
  console.log(
    `✅ Billing subscription for workspace '${createdWorkspace.name}' created.`,
  )

  // --- 10. Create Tags (Default) ---
  await db.insert(schema.tags).values(
    DEFAULT_WORKSPACE_TAGS.map((tag) => ({
      ...tag,
      workspaceId: createdWorkspace.id,
      createdAt: new Date(),
      updatedAt: new Date(),
    })),
  )
  console.log('✅ Default tags created for workspace.')

  // --- 11. Create Notifications (Inbox Items) (Approx. 10) - Using drizzle-seed ---
  // Fetch some contacts created by drizzle-seed earlier to use in notifications
  const notificationContacts = await db
    .select({ id: schema.contacts.id, name: schema.contacts.name })
    .from(schema.contacts)
    .where(eq(schema.contacts.workspaceId, createdWorkspace.id))
    .limit(20)

  if (notificationContacts.length > 0) {
    const contactIds = notificationContacts.map((c) => c.id)

    const notificationTypes = [
      { type: 'comment', metadata: { message: 'left a comment' } },
      { type: 'action', metadata: { action: 'created-contact' } },
      { type: 'update', metadata: { field: 'name', value: 'John Doe' } },
      { type: 'tags', metadata: { tags: ['tag1', 'tag2'] } },
      { type: 'type', metadata: { type: 'customer' } },
      { type: 'status', metadata: { status: 'active' } },
    ] as const

    await seed(db, { notifications: schema.notifications }).refine((f) => ({
      notifications: {
        count: 10,
        columns: {
          id: f.valuesFromArray({
            isUnique: true,
            values: Array.from({ length: 10 }, () => createId()),
          }),
          workspaceId: f.default({ defaultValue: createdWorkspace.id }),
          type: f.valuesFromArray({
            values: notificationTypes.map((type) => type.type),
          }),
          targetId: f.default({ defaultValue: ownerUser.id }),
          targetType: f.default({ defaultValue: 'user' }),
          actorType: f.weightedRandom([
            {
              value: f.default({ defaultValue: 'user' }),
              weight: 1,
            },
          ]),
          actorId: f.default({ defaultValue: ownerUser.id }),
          subjectId: f.valuesFromArray({
            values: contactIds,
            isUnique: true,
          }),
          subjectType: f.default({ defaultValue: 'contact' }),
          metadata: f.valuesFromArray({
            values: notificationTypes.map((type) =>
              JSON.stringify(type.metadata),
            ),
          }),
          readAt: f.weightedRandom([
            {
              value: f.default({ defaultValue: null }),
              weight: 0.67,
            },
            {
              value: f.date({
                minDate: new Date('2025-01-01'),
                maxDate: new Date(),
              }),
              weight: 0.33,
            },
          ]),
          readById: f.weightedRandom([
            {
              value: f.default({ defaultValue: ownerUser.id }),
              weight: 0.33,
            },
            { value: f.default({ defaultValue: null }), weight: 0.67 },
          ]),
          createdAt: f.date({
            minDate: new Date('2025-01-01'),
            maxDate: new Date(),
          }),
          updatedAt: f.date({
            minDate: new Date('2025-01-01'),
            maxDate: new Date(),
          }),
        },
      },
    }))
    console.log(`✅ 10 notifications created using drizzle-seed.`)
  } else {
    console.log(
      '⚠️ Skipped creating notifications as no contacts were found for the workspace.',
    )
  }

  // --- 12. Create Activity Logs (5) - Using drizzle-seed ---
  // Fetch an example contact ID for activity logs, after contacts are seeded
  const someContactsForLog = await db
    .select({ id: schema.contacts.id })
    .from(schema.contacts)
    .where(eq(schema.contacts.workspaceId, createdWorkspace.id))
    .limit(1)
  // Ensure we have a valid contact ID, or a fallback if no contacts were created (e.g. if count was 0)
  const exampleContactIdForLog =
    someContactsForLog.length > 0
      ? someContactsForLog[0].id
      : `fallback_contact_${createId().substring(0, 8)}`

  const activityLogTypes = [
    'contact.created' as const,
    'contact.updated' as const,
    'note.added' as const,
  ]

  await seed(db, { activityLogs: schema.activityLogs }).refine((f) => ({
    activityLogs: {
      count: 5,
      columns: {
        id: f.valuesFromArray({
          values: Array.from({ length: 5 }, () => createId()),
        }),
        workspaceId: f.default({ defaultValue: createdWorkspace.id }),
        actorId: f.default({ defaultValue: ownerUser.id }),
        actorType: f.default({ defaultValue: 'user' as const }),
        subjectId: f.default({ defaultValue: exampleContactIdForLog }),
        subjectType: f.default({ defaultValue: 'contact' as const }),
        type: f.valuesFromArray({ values: activityLogTypes }),
        metadata: f.default({
          defaultValue: {
            info: `Activity log random info ${f.int({ minValue: 1, maxValue: 100 })}`,
          },
        }),
        createdAt: f.date({
          minDate: new Date('2025-01-01'),
          maxDate: new Date(),
        }),
        updatedAt: f.date({
          minDate: new Date('2025-01-01'),
          maxDate: new Date(),
        }),
      },
    },
  }))
  // The original script had a loop with try-catch for individual inserts.
  // drizzle-seed handles batch insertion; errors would typically stop the process.
  console.log('✅ 5 activity logs created using drizzle-seed.')

  return {
    email: testEmail,
    password: testPassword,
  }
}

runSeed()
  .then(({ email, password }) => {
    console.log('\n🌱 Finished seeding database.')
    console.log('------------------------------')
    console.log(`🔩 Email: ${email}`)
    console.log(`🔩 Password: ${password}`)
    process.exit(0)
  })
  .catch((err) => {
    console.error('\nUnhandled error in seed script: ❌', err)
    process.exit(1)
  })
