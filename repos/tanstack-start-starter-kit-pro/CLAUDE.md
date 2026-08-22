# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Saas.js - TanStack Start starter kit. A full-stack SaaS application providing building blocks for building products with TanStack Start, featuring multi-tenant workspace architecture with authentication, billing, and comprehensive feature modules.

**Tech Stack**: TanStack Start (React meta-framework), Chakra UI 3, Saas UI 3, tRPC 11, Drizzle ORM, PostgreSQL, Better Auth, Stripe, React Email + Resend

**Package Manager**: pnpm 9.15.0 (required)

## Common Commands

### Development

```bash
pnpm dev              # Run all dev servers via turbo
pnpm dev:web          # Run only web app (port 3000)
pnpm storybook        # Run Storybook
```

### Build & Quality

```bash
pnpm build:web        # Build web app
pnpm typecheck        # Check types on all apps and packages
pnpm check:fast       # Lint and typecheck
pnpm check:smoke      # Lint, typecheck and run smoke tests
pnpm format:write     # Checka and fix formatting
```

### Database Operations

```bash
pnpm db:generate      # Generate migrations
pnpm db:migrate       # Run migrations (production)
pnpm db:seed          # Seed empty DB
```

### Billing

```bash
pnpm billing:sync     # Sync Stripe plans with database
```

### Initial Setup

```bash
pnpm install
docker-compose up -d  # Start PostgreSQL
pnpm db:push && pnpm db:seed
```

## Architecture Overview

### Monorepo Structure

**Apps**:

- `apps/web/` - Main TanStack Start application

**Packages**:

- `packages/api/` - tRPC API layer with modular business logic
- `packages/db/` - Drizzle ORM schemas and migrations
- `packages/better-auth/` - Better Auth configuration
- `packages/billing-stripe/` - Stripe integration
- `packages/email/` - React Email templates
- `packages/ui/` - Shared UI components
- `packages/i18n/` - Internationalization
- `packages/env/` - Environment validation
- `tooling/mocks/` - Mock data generation

### Multi-Tenant Architecture

This is a **workspace-based multi-tenant application**. Key concepts:

- Every route under `/$workspace/` is scoped to a workspace
- tRPC procedures enforce workspace membership and roles
- Four procedure types (in order of access):
  - `publicProcedure` - Unauthenticated
  - `protectedProcedure` - Authenticated users
  - `workspaceProcedure` - Workspace members (injects `workspace` in context)
  - `adminProcedure` - Workspace admins

### API Module Pattern

Location: `packages/api/modules/[module]/`

Each module follows this structure:

- `[module].router.ts` - tRPC routes (validation only)
- `[module].schema.ts` - Zod schemas for input/output
- `[module].service.ts` - Business logic (NOT in routes)

**Important**: All business logic must be in services, not routes. Routes should only validate input and call service methods.

To add a new module:

1. Create folder in `packages/api/modules/[module]/`
2. Create router, schema, and service files
3. Import router in `packages/api/trpc/router.ts` using absolute import: `import { moduleRouter } from '#modules/module/module.router'`

### Database Schema Pattern

Location: `packages/db/src/[table]/[table].sql.ts`

**Critical**: Uses Drizzle ORM (NOT Prisma)

Utility functions (from `packages/db/src/utils.ts`):

- `pgTable()` - Define tables
- `id()` - Primary key UUID column
- `workspaceId()` - Foreign key to workspaces (for multi-tenancy)
- `userId()` - Foreign key to users
- `timestamps()` - createdAt/updatedAt columns

**Process**:

1. Create schema file: `packages/db/src/[table]/[table].sql.ts`
2. Import in `packages/db/src/db.ts` (required for Drizzle to detect it)
3. Run `pnpm db:generate` to create migration
4. Run `pnpm db:migrate` or `pnpm db:push`

### Web App Structure

Location: `apps/web/src/`

**Key directories**:

- `routes/` - TanStack Router routes
  - `_auth/` - Public auth routes (login, signup, etc.)
  - `_app/` - Protected app routes
  - `_app/$workspace/` - Workspace-scoped routes
  - `api/` - API endpoints (tRPC, webhooks)
- `features/` - Feature modules organized by domain
  - Each feature is self-contained with components, hooks, schemas
  - Page components named `*-page.tsx`
  - Routes import from features
- `components/` - Shared components (breadcrumbs, buttons, etc.)
- `hooks/` - Shared React hooks
- `lib/` - Shared libraries (tRPC client, user settings)
- `theme/` - Chakra UI theme customization

**Import aliases**:

```typescript
import { Button } from '#components/button'
import { DashboardPage } from '#features/reports/reports-page'
import { useCurrentUser } from '#hooks/use-current-user'
import { trpc } from '#lib/trpc'
```

### File Naming & Export Conventions

**File naming**: Use `snake-case` for all files

- Pages: `reports-page.tsx`
- Components: `contact-list.tsx`
- Schemas: `contacts.schema.ts`
- Services: `contacts.service.ts`

**Exports**:

- ALWAYS use named exports (NO default exports)
- NO barrel exports (index.ts) for features
- Use `function` keyword for components (not arrow functions)

Example:

```typescript
// Good
export function ContactsList() { ... }

// Bad
export default () => { ... }
const ContactsList = () => { ... }
export default ContactsList
```

### Type Safety Rules

- Do not use `as any` to bypass type errors.
- Do not cast values to broad escape-hatch types to silence TypeScript.
- If the only remaining fix appears to require casting a value to a specific type, stop and ask the user before applying that cast.
- Prefer fixing types at the source (narrowing, guards, correct generics, accurate interfaces, or API-aligned types).

### UI Framework - Chakra UI 3 & Saas UI 3

**Important**: This project uses Chakra UI 3.30+ (NOT v2.0)

**Styling guidelines**:

- Use specific props: `borderWidth="1px"` not `border="1px solid"`
- Prefer Saas UI components when available (check `@saas-ui/*` packages)
- Use semantic tokens from theme
- Use Chakra's style props system

Example:

```tsx
// Good
<Box borderWidth="1px" borderColor="border.muted" p={4}>

// Bad
<Box border="1px solid gray" padding="16px">
```

### Routing

**Framework**: TanStack Router (type-safe, file-based routing)

**Route patterns**:

- Public: `/login`, `/signup`
- App entry: `/`
- Workspace routes: `/$workspace/contacts`, `/$workspace/settings/*`
- API: `/api/trpc/$`, `/api/auth/$`, `/api/webhooks/stripe`

Routes use params like `$workspace`, `$id`, `$tag` for dynamic segments.

### Data Fetching

**tRPC + TanStack Query** for all API calls:

```typescript
// In components
const { data } = trpc.contacts.list.useQuery({
  workspaceId: workspace.id,
})

const mutation = trpc.contacts.create.useMutation({
  onSuccess: () => {
    // Invalidate queries
    utils.contacts.list.invalidate()
  },
})
```

**Server-side**:

```typescript
// In API services - packages/api/modules/contacts/contacts.service.ts
import { and, contacts, db, eq } from '@workspace/db'

import { ServiceError } from '#utils/error'

export const getContactById = async (args: {
  workspaceId: string
  id: string
}) => {
  const contact = await db.query.contacts.findFirst({
    where: and(
      eq(contacts.workspaceId, args.workspaceId),
      eq(contacts.id, args.id),
    ),
  })

  if (!contact) {
    throw new ServiceError(
      'contacts.not_found',
      `Could not find contact with id ${args.id}`,
    )
  }

  return contact
}

export const createContact = async (args: CreateContactArgs) => {
  return await db.transaction(async (tx) => {
    const result = await tx
      .insert(contacts)
      .values({
        ...args,
        type: args.type ?? 'lead',
      })
      .returning()

    return result[0]
  })
}
```

## Environment Variables

Required for development (see `.env.example`):

- `DATABASE_URL` - PostgreSQL connection
- `AUTH_SECRET` - Authentication secret
- `VITE_STRIPE_PUBLISHABLE_KEY` / `STRIPE_SECRET_KEY` - Stripe keys
- `STRIPE_WEBHOOK_SECRET` - For Stripe webhooks
- `RESEND_API_KEY` - Email service
- `APP_URL` / `VITE_API_URL` - Application URLs

Generate via: `pnpm turbo gen env`

## Testing

**Framework**: Vitest (configured but no tests currently exist)

When writing tests, use Vitest patterns and place test files adjacent to source files.

## First Files To Read (By Task Type)

Read these files first before broad repo scans.

### UI / Route / Frontend tasks

1. `apps/web/src/routes/...` (the specific route being changed)
2. `apps/web/src/features/...` (the feature page/component used by that route)
3. `apps/web/src/router.tsx`
4. `apps/web/src/provider.tsx`
5. `apps/web/vite.config.ts`

### API module tasks

1. `packages/api/modules/<module>/<module>.router.ts`
2. `packages/api/modules/<module>/<module>.schema.ts`
3. `packages/api/modules/<module>/<module>.service.ts`
4. `packages/api/trpc/router.ts`
5. `packages/api/trpc/trpc.ts`

### Database / schema tasks

1. `packages/db/src/<table>/<table>.sql.ts`
2. `packages/db/src/db.ts`
3. `packages/db/drizzle.config.ts`
4. `packages/db/drizzle/meta/_journal.json`
5. `packages/db/src/seed.ts`

## Common Pitfalls

1. **Database schemas must be imported** in `packages/db/src/db.ts` or Drizzle won't detect them
2. **Business logic goes in services**, not in tRPC routes
3. **Use workspaceProcedure** for any workspace-scoped operations
4. **Import new API modules** in `packages/api/trpc/router.ts` using absolute imports
5. **Check Chakra UI 3 docs** - API changed significantly from v2
6. **No default exports** - the codebase uses named exports throughout
7. **File naming is snake-case** - not camelCase or PascalCase
8. **Do not edit generated route tree** - never modify `apps/web/src/routeTree.gen.ts` manually; it is generated and will be overwritten

## Key Features

Available modules/features:

- Authentication (Better Auth) with email/password
- Workspaces with member management and roles
- Contacts management with tagging
- Billing/subscriptions via Stripe
- Activity logs (audit trail)
- Notifications system
- Settings (user profile, workspace, billing, members)
- Search functionality
- Email templates (React Email)

## Development Workflow

1. **Adding a new feature**:
   - Create feature folder in `apps/web/src/features/[feature]/`
   - Create API module in `packages/api/modules/[feature]/` (router, schema, service)
   - Create DB schema in `packages/db/src/[table]/[table].sql.ts`
   - Add page component as `[feature]-page.tsx`
   - Add route in `apps/web/src/routes/_app/$workspace/[feature]/`

2. **Database changes**:
   - Edit schema in `packages/db/src/[table]/[table].sql.ts`
   - Import in `packages/db/src/db.ts`
   - Run `pnpm db:generate` and `pnpm db:migrate`

3. **Debugging**:
   - Check browser console for tRPC errors
   - Use `pnpm db:studio` to inspect database
   - Logs appear in terminal running `pnpm dev:web`

## Additional Context

- Built with Turbo monorepo for fast builds
- Git hooks via Husky run linting on commit
- Uses SuperJSON for tRPC serialization (Date objects work)
- i18n support available via `@workspace/i18n` package
- Activity logs track all important actions (configured per module)
- Stripe webhooks handle subscription updates
- Email templates in `packages/email/templates/`
