# Error Handling Guide

This document describes the error handling patterns and best practices used throughout the application.

## Table of Contents

- [Backend Error Handling](#backend-error-handling)
- [Frontend Error Handling](#frontend-error-handling)
- [Error Logging](#error-logging)
- [Best Practices](#best-practices)

## Backend Error Handling

### Custom Error Classes

The application uses a custom `ServiceError` class for domain-specific errors.

**Location**: [packages/api/utils/error.ts](../packages/api/utils/error.ts)

```typescript
export class ServiceError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message)
  }
}
```

**Usage Example**:

```typescript
import { and, contacts, db, eq } from '@workspace/db'

import { ServiceError } from '#utils/error'

export const getContactById = async (args: {
  contactId: string
  workspaceId: string
}) => {
  const contact = await db.query.contacts.findFirst({
    where: and(
      eq(contacts.id, args.contactId),
      eq(contacts.workspaceId, args.workspaceId),
    ),
  })

  if (!contact) {
    throw new ServiceError(
      'contacts.not_found',
      `Could not find contact with id ${args.contactId}`,
    )
  }

  return contact
}
```

### tRPC Error Handling

#### Error Formatter

The tRPC error formatter extracts `ServiceError` codes and flattens Zod validation errors for easy frontend consumption.

**Location**: [packages/api/trpc/trpc.ts:33-43](../packages/api/trpc/trpc.ts)

```typescript
errorFormatter({ shape, error }) {
  return {
    ...shape,
    data: {
      ...shape.data,
      cause: error.cause instanceof ServiceError ? error.cause.code : null,
      zodError:
        error.cause instanceof ZodError ? error.cause.flatten() : null,
    },
  }
}
```

This formatter:

- Exposes `ServiceError` codes in the `cause` field
- Flattens Zod validation errors in the `zodError` field
- Preserves the original error shape

#### Middleware Error Wrapping

The base procedure middleware automatically wraps `ServiceError` into `TRPCError`.

**Location**: [packages/api/trpc/trpc.ts:64-79](../packages/api/trpc/trpc.ts)

```typescript
const procedure = t.procedure.use(async ({ ctx, next }) => {
  const resp = await withAdapters(ctx, () =>
    next({
      ctx,
    }),
  )

  if (!resp.ok && resp.error.cause instanceof ServiceError) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      cause: resp.error.cause,
    })
  }

  return resp
})
```

#### Authorization Errors

Authorization middleware throws appropriate `TRPCError` codes:

```typescript
// Unauthorized - Not logged in
throw new TRPCError({ code: 'UNAUTHORIZED' })

// Not Found - Workspace doesn't exist
throw new TRPCError({
  code: 'NOT_FOUND',
  message: 'Workspace not found',
})

// Unauthorized - Not a workspace member
throw new TRPCError({
  code: 'UNAUTHORIZED',
  message: 'Not a member of this workspace',
})
```

**tRPC Error Codes**:

- `UNAUTHORIZED` - Authentication required or insufficient permissions
- `NOT_FOUND` - Resource not found
- `BAD_REQUEST` - Invalid input or business logic error
- `INTERNAL_SERVER_ERROR` - Unexpected server error

### Validation Errors

Zod validation errors are automatically caught by tRPC and returned to the client with the flattened error structure.

**Internationalized Error Messages**: [packages/i18n/src/zod/error-messages.ts](../packages/i18n/src/zod/error-messages.ts)

```typescript
export const errorMessages = defineMessages({
  'string.required': {
    id: 'validation/string.required',
    defaultMessage: 'Required',
  },
  'string.invalid.email': {
    id: 'validation/string.invalid.email',
    defaultMessage: 'Invalid email',
  },
  // ... more validation messages
})
```

### Database Error Handling

Database operations use transactions for atomicity. Errors are caught and converted to `ServiceError` when needed.

```typescript
export const createWorkspace = async (args) => {
  return db.transaction(async (tx) => {
    const result = await tx
      .insert(workspaces)
      .values({...})
      .returning()
      .execute()

    const workspace = result[0]

    if (!workspace) {
      throw new ServiceError(
        'workspaces.creation_failed',
        'Failed to create workspace'
      )
    }

    // More operations...
    return workspace
  })
}
```

## Frontend Error Handling

### tRPC Client Setup

The tRPC client logs all errors in production and all operations in development.

**Location**: [apps/web/src/lib/trpc/react.tsx](../apps/web/src/lib/trpc/react.tsx)

```typescript
api.createClient({
  links: [
    loggerLink({
      enabled: (op) =>
        import.meta.env.DEV ||
        (op.direction === 'down' && op.result instanceof Error),
    }),
    // ... other links
  ],
})
```

### Error Type Guard

Use the `isTRPCClientError` type guard to safely check if an error is a tRPC error.

**Location**: [apps/web/src/lib/trpc/utils.ts](../apps/web/src/lib/trpc/utils.ts)

```typescript
import { isTRPCClientError } from '#lib/trpc/utils'

try {
  await someOperation()
} catch (error) {
  if (isTRPCClientError(error)) {
    // Access tRPC-specific error properties
    console.error(error.data?.cause) // ServiceError code
    console.error(error.data?.zodError) // Validation errors
  }
}
```

### Mutation Error Handling

Handle errors in mutation callbacks using `onError`:

```typescript
const createContactMutation = api.contacts.create.useMutation({
  onSuccess: (data) => {
    toast.success({
      title: 'Person added',
      action: {
        label: 'View person',
        onClick: () => navigate(...),
      },
    })
  },
  onError: (error) => {
    console.error(error)
    toast.error({
      title: 'Failed to add person',
    })
  },
  onSettled: () => {
    // Invalidate queries regardless of success/failure
    utils.contacts.listByType.invalidate({ workspaceId: workspace.id })
  },
})
```

### Toast Notifications

Use the `@saas-ui/react` toast system for user-facing error messages:

```typescript
import { toast } from '@saas-ui/react'

// Error notification
toast.error({
  title: 'Failed to add person',
  description: 'Please try again later.',
})

// Success notification with action
toast.success({
  title: 'Person added',
  action: {
    label: 'View person',
    onClick: () => {
      /* action */
    },
  },
})

// Warning notification
toast.warning({
  title: 'Session expiring soon',
  description: 'Please save your work.',
})
```

### Try-Catch Pattern

For async operations outside mutations, use try-catch with toast notifications:

```typescript
onSubmit: async (data) => {
  try {
    const result = await mutateAsync({ name: data.name, slug: data.slug })
    if (result?.slug) {
      workspace.set(result.slug)
      stepper.goToNextStep()
    }
  } catch (error: any) {
    toast.error({
      title: 'Failed to create workspace',
      description: error.message,
    })
  }
}
```

### Form Validation Errors

Forms use Zod schemas for validation. Errors are displayed inline by the form library.

```typescript
const form = useForm({
  schema: updatePasswordSchema,
  defaultValues: {
    password: '',
    newPassword: '',
    confirmPassword: '',
  },
  onInvalid: onValidationError, // Called when form validation fails
  onSubmit: async (values) => {
    try {
      const data = await submit(values)
      onSuccess(data)
    } catch (error) {
      onError(error)
    }
  },
})
```

**Manual Error Setting** for async validations:

```typescript
const slugAvailable = api.workspaces.slugAvailable.useMutation({
  onSettled: (data) => {
    if (!data?.available) {
      form.setError('slug', {
        type: 'manual',
        message: 'This workspace URL is already taken.',
      })
    } else {
      form.clearErrors('slug')
    }
  },
})
```

### Route-Level Error Components

Define custom error components for specific routes:

```typescript
export const Route = createFileRoute(
  '/_app/$workspace/_dashboard/contacts/view/$id',
)({
  notFoundComponent: NotFoundComponent,
  errorComponent: ContactError,
  component: RouteComponent,
})
```

**Custom Error Component**: [apps/web/src/features/contacts/view/contact.error.tsx](../apps/web/src/features/contacts/view/contact.error.tsx)

```typescript
export function ContactError(props: ErrorComponentProps) {
  return (
    <EmptyState
      title="Failed to load contact"
      description="An error occurred while loading the contact."
      height="full"
      actions={
        <>
          <Button onClick={props.reset}>Try again</Button>
        </>
      }
    />
  )
}
```

### Default Error Page

The application provides a default error page with development-mode stack traces.

**Location**: [apps/web/src/components/default-error-page.tsx](../apps/web/src/components/default-error-page.tsx)

Features:

- Shows error stack in development mode only
- Provides "Try Again" action that invalidates router cache
- Shows "Go Back" or "Home" button depending on route
- Uses the generic `ErrorPage` component

## Error Logging

### Backend Logging

The tRPC context includes a logger for server-side logging:

```typescript
const logger = {
  info: console.log,
  error: console.error,
  debug: (...args: any[]) => {
    if (debug) {
      console.log(...args)
    }
  },
}
```

**Usage in procedures**:

```typescript
export const someRouter = router({
  someOperation: protectedProcedure
    .input(schema)
    .mutation(async ({ ctx, input }) => {
      ctx.logger.info('Starting operation', input)

      try {
        const result = await performOperation(input)
        return result
      } catch (error) {
        ctx.logger.error('Operation failed', error)
        throw error
      }
    }),
})
```

### Database Query Logging

Database queries are logged in non-production environments:

```typescript
export const db = drizzle(postgres(process.env.DATABASE_URL!), {
  schema,
  logger: process.env.NODE_ENV !== 'production',
})
```

### Frontend Logging

Console errors are logged in mutation error handlers:

```typescript
onError: (error) => {
  console.error(error)
  toast.error({
    title: 'Failed to add person',
  })
}
```

### Production Error Monitoring

**Current Status**: No third-party error monitoring service is configured.

**Recommended**: Integrate a service like Sentry, Bugsnag, or Datadog for production error tracking.

## Best Practices

### Backend Best Practices

#### 1. Always Use ServiceError for Domain Errors

**Why**: Provides consistent error codes that can be used for internationalization and specific error handling on the frontend.

```typescript
// Good - Structured error with code
if (!contact) {
  throw new ServiceError(
    'contacts.not_found',
    `Could not find contact with id ${contactId}`,
  )
}

// Bad - Generic error without code
if (!contact) {
  throw new Error('Contact not found')
}
```

**Error code naming convention**: Use dot notation like `module.error_type` (e.g., `contacts.not_found`, `workspaces.owner_not_found`, `billing.subscription_required`).

#### 2. Keep Business Logic in Services, Not Routers

**Why**: Separation of concerns, testability, and reusability.

```typescript
// Good - Router delegates to service
export const contactsRouter = router({
  create: workspaceProcedure
    .input(createContactSchema)
    .mutation(({ input, ctx }) =>
      createContact({ ...input, userId: ctx.session.user.id })
    ),
})

// Bad - Business logic in router
export const contactsRouter = router({
  create: workspaceProcedure
    .input(createContactSchema)
    .mutation(async ({ input, ctx }) => {
      // Validation logic here
      // Database operations here
      // Side effects here
      // This makes testing and reuse difficult
    }),
})
```

#### 3. Use Transactions for Multi-Step Operations

**Why**: Ensures data consistency and prevents partial updates.

```typescript
// Good - Atomic operation
export const createWorkspace = async (args: CreateWorkspaceArgs) => {
  return db.transaction(async (tx) => {
    const workspace = await tx.insert(workspaces).values(args).returning()
    const member = await tx.insert(workspaceMembers).values({
      workspaceId: workspace[0].id,
      userId: args.ownerId,
      role: 'admin',
    }).returning()

    return workspace[0]
  })
}

// Bad - Non-atomic, can leave inconsistent state
export const createWorkspace = async (args: CreateWorkspaceArgs) => {
  const workspace = await db.insert(workspaces).values(args).returning()
  // If this fails, workspace exists without member
  await db.insert(workspaceMembers).values({
    workspaceId: workspace[0].id,
    userId: args.ownerId,
    role: 'admin',
  })
  return workspace[0]
}
```

#### 4. Validate Input with Zod Schemas

**Why**: Runtime type safety and automatic error messages.

```typescript
// In router
export const contactsRouter = router({
  create: workspaceProcedure
    .input(createContactSchema) // Zod validation happens here
    .mutation(({ input }) => createContact(input)),
})

// In schema file
export const createContactSchema = z.object({
  workspaceId: z.string(),
  email: z.string().email(),
  firstName: z.string().min(1),
  lastName: z.string().optional(),
  type: z.enum(['lead', 'customer', 'partner']).default('lead'),
})
```

#### 5. Use Appropriate tRPC Error Codes

**Why**: Allows clients to handle different error types appropriately.

```typescript
// Authentication required
throw new TRPCError({
  code: 'UNAUTHORIZED',
  message: 'You must be logged in',
})

// Missing resource
throw new TRPCError({
  code: 'NOT_FOUND',
  message: 'Workspace not found',
})

// Invalid input or business rule violation
throw new TRPCError({
  code: 'BAD_REQUEST',
  cause: new ServiceError('contacts.duplicate_email', 'Email already exists'),
})

// Insufficient permissions
throw new TRPCError({
  code: 'FORBIDDEN',
  message: 'You do not have permission to perform this action',
})
```

#### 6. Include Context in Error Messages

**Why**: Makes debugging much easier.

```typescript
// Good - Specific, actionable error
throw new ServiceError(
  'workspaces.member_not_found',
  `User ${userId} is not a member of workspace ${workspaceId}`,
)

// Bad - Vague error
throw new ServiceError('member_not_found', 'Member not found')
```

#### 7. Log Errors with Context

**Why**: Essential for debugging production issues.

```typescript
export const updateContact = async (args: UpdateContactArgs) => {
  try {
    return await db.transaction(async (tx) => {
      // ... operations
    })
  } catch (error) {
    // Log with context before re-throwing
    console.error('Failed to update contact', {
      contactId: args.id,
      workspaceId: args.workspaceId,
      error: error instanceof Error ? error.message : error,
    })
    throw error
  }
}
```

### Frontend Best Practices

#### 1. Use Type Guards for Error Checking

**Why**: Type safety when accessing tRPC-specific error properties.

```typescript
import { isTRPCClientError } from '#lib/trpc/utils'

// Good - Type-safe error handling
const mutation = api.contacts.create.useMutation({
  onError: (error) => {
    if (isTRPCClientError(error)) {
      // Access tRPC-specific properties
      const errorCode = error.data?.cause // ServiceError code
      const zodErrors = error.data?.zodError // Validation errors

      if (errorCode === 'contacts.duplicate_email') {
        toast.error({
          title: 'Email already exists',
          description:
            'A contact with this email already exists in your workspace.',
        })
        return
      }
    }

    // Generic error
    toast.error({
      title: 'Failed to create contact',
      description: error.message,
    })
  },
})

// Bad - Using 'any' loses type safety
onError: (error: any) => {
  toast.error({ title: error.message }) // No intellisense, error-prone
}
```

#### 2. Provide User-Friendly, Actionable Error Messages

**Why**: Better user experience and reduces support requests.

```typescript
// Good - Clear, actionable messages
toast.error({
  title: 'Failed to send invitation',
  description: 'Please check the email address and try again.',
  action: {
    label: 'Retry',
    onClick: () => mutation.mutate(data),
  },
})

// Bad - Technical jargon
toast.error({
  title: 'TRPC_ERROR: BAD_REQUEST',
  description: 'contacts.validation_failed: email is not valid',
})
```

#### 3. Handle Different Error Types Appropriately

**Why**: Different errors require different UX treatments.

```typescript
const mutation = api.contacts.create.useMutation({
  onError: (error) => {
    if (isTRPCClientError(error)) {
      // Handle validation errors - show inline in form
      if (error.data?.zodError) {
        const fieldErrors = error.data.zodError.fieldErrors
        Object.keys(fieldErrors).forEach((field) => {
          form.setError(field as any, {
            message: fieldErrors[field]?.[0],
          })
        })
        return // Don't show toast for validation errors
      }

      // Handle specific business errors
      const errorCode = error.data?.cause
      if (errorCode === 'contacts.duplicate_email') {
        form.setError('email', {
          message: 'This email is already in use',
        })
        return
      }

      // Handle authorization errors
      if (error.data?.code === 'UNAUTHORIZED') {
        navigate({ to: '/login' })
        return
      }
    }

    // Generic error - show toast
    toast.error({
      title: 'Failed to create contact',
      description:
        'Please try again or contact support if the problem persists.',
    })
  },
})
```

#### 4. Implement Proper Loading and Error States

**Why**: Users need feedback about what's happening.

```typescript
function ContactsList() {
  const { data, error, isLoading, refetch } = api.contacts.list.useQuery({
    workspaceId: workspace.id,
  })

  // Loading state
  if (isLoading) {
    return <Skeleton count={5} />
  }

  // Error state with retry
  if (error) {
    return (
      <EmptyState
        icon={<LuAlertCircle />}
        title="Failed to load contacts"
        description="We couldn't load your contacts. Please try again."
        actions={
          <Button onClick={() => refetch()}>
            Try Again
          </Button>
        }
      />
    )
  }

  // Empty state (different from error state)
  if (!data?.length) {
    return (
      <EmptyState
        icon={<LuUsers />}
        title="No contacts yet"
        description="Get started by adding your first contact."
        actions={
          <Button onClick={() => openDialog()}>
            Add Contact
          </Button>
        }
      />
    )
  }

  return <ContactsList contacts={data} />
}
```

#### 5. Handle Network Errors Gracefully

**Why**: Network issues are common and often transient.

```typescript
// TanStack Query configuration with retries
const { data } = api.contacts.list.useQuery(
  { workspaceId: workspace.id },
  {
    retry: 3, // Retry 3 times
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    staleTime: 5 * 60 * 1000, // 5 minutes
    onError: (error) => {
      // Only show toast on final retry failure
      console.error('Failed to load contacts after retries', error)
    },
  },
)
```

#### 6. Use Optimistic Updates with Rollback

**Why**: Better perceived performance, but need to handle failures.

```typescript
const updateContact = api.contacts.update.useMutation({
  onMutate: async (updatedContact) => {
    // Cancel outgoing refetches
    await utils.contacts.list.cancel()

    // Snapshot previous value
    const previousContacts = utils.contacts.list.getData()

    // Optimistically update
    utils.contacts.list.setData({ workspaceId: workspace.id }, (old) =>
      old?.map((c) =>
        c.id === updatedContact.id ? { ...c, ...updatedContact } : c,
      ),
    )

    return { previousContacts }
  },
  onError: (err, variables, context) => {
    // Rollback on error
    if (context?.previousContacts) {
      utils.contacts.list.setData(
        { workspaceId: workspace.id },
        context.previousContacts,
      )
    }

    toast.error({
      title: 'Failed to update contact',
      description: 'Your changes have been reverted.',
    })
  },
  onSettled: () => {
    // Always refetch to ensure consistency
    utils.contacts.list.invalidate()
  },
})
```

#### 7. Don't Over-Notify Users

**Why**: Too many notifications create notification fatigue.

```typescript
// Good - Only show important errors
onError: (error) => {
  if (isTRPCClientError(error)) {
    // Don't toast validation errors (shown inline in form)
    if (error.data?.zodError) return

    // Don't toast expected errors (handled by UI state)
    if (error.data?.code === 'NOT_FOUND') return
  }

  // Only toast unexpected errors
  toast.error({ title: 'Something went wrong' })
}

// Bad - Toasts everything
onError: (error) => {
  toast.error({ title: error.message }) // Annoying for users
}
```

#### 8. Provide Recovery Actions

**Why**: Helps users resolve errors without leaving the page.

```typescript
toast.error({
  title: 'Failed to delete contact',
  description: 'This contact has open deals. Please close them first.',
  action: {
    label: 'View Deals',
    onClick: () =>
      navigate({
        to: '/$workspace/deals',
        params: { workspace: workspace.slug },
        search: { contactId: contact.id },
      }),
  },
  duration: 10000, // Longer duration for actionable errors
})
```

#### 9. Log Errors for Debugging

**Why**: Essential for troubleshooting production issues.

```typescript
onError: (error) => {
  // Always log with context
  console.error('Failed to create contact', {
    workspaceId: workspace.id,
    contactData: data,
    error: error,
    timestamp: new Date().toISOString(),
  })

  // In production, send to monitoring service
  if (import.meta.env.PROD) {
    // sentry.captureException(error, { contexts: { ... } })
  }

  toast.error({
    title: 'Failed to create contact',
  })
}
```

#### 10. Handle Form Submission Errors Properly

**Why**: Users need to know what went wrong and how to fix it.

```typescript
const form = useForm({
  schema: createContactSchema,
  onSubmit: async (values) => {
    try {
      const contact = await createContact.mutateAsync({
        ...values,
        workspaceId: workspace.id,
      })

      toast.success({
        title: 'Contact created',
        action: {
          label: 'View',
          onClick: () => navigate({ to: `/contacts/${contact.id}` }),
        },
      })

      onClose()
    } catch (error) {
      if (isTRPCClientError(error)) {
        // Handle validation errors
        if (error.data?.zodError) {
          const fieldErrors = error.data.zodError.fieldErrors
          Object.entries(fieldErrors).forEach(([field, messages]) => {
            form.setError(field as any, { message: messages?.[0] })
          })
          return // Don't show toast, errors are inline
        }

        // Handle business rule violations
        const errorCode = error.data?.cause
        if (errorCode === 'contacts.duplicate_email') {
          form.setError('email', {
            message: 'A contact with this email already exists',
          })
          return
        }
      }

      // Show generic error as toast (form stays open)
      toast.error({
        title: 'Failed to create contact',
        description: 'Please try again or contact support.',
      })
    }
  },
})
```

### User Experience Best Practices

#### 1. Error Message Tone

- **Be empathetic**: "We couldn't save your changes" vs "Save failed"
- **Be specific**: "This email is already in use" vs "Invalid input"
- **Be helpful**: Suggest what to do next
- **Avoid blame**: "Something went wrong" vs "You entered invalid data"

#### 2. Error Message Timing

- **Inline validation**: Show immediately on blur or after user stops typing
- **Form errors**: Show on submit attempt
- **Network errors**: Show after retries exhausted
- **Critical errors**: Show immediately

#### 3. Error Recovery

- Always provide a way forward (retry, go back, contact support)
- Preserve user data when possible (don't clear forms on error)
- Auto-retry transient errors silently
- Offer alternative actions when primary action fails

#### 4. Visual Hierarchy

- **Critical errors**: Modal dialogs with blocking UI
- **Important errors**: Toast notifications
- **Field errors**: Inline with red text/border
- **Background errors**: Subtle indicators in status bar

### Testing Error Scenarios

1. Test error handling in services:

   ```typescript
   it('should throw ServiceError when contact not found', async () => {
     await expect(
       contactsService.getById({ contactId: 'invalid', workspaceId: 'w1' }),
     ).rejects.toThrow(ServiceError)
   })
   ```

2. Test error handling in components:

   ```typescript
   it('should show error toast on mutation failure', async () => {
     // Mock mutation to fail
     // Trigger mutation
     // Assert toast.error was called
   })
   ```

3. Test validation errors:
   ```typescript
   it('should show validation errors for invalid email', async () => {
     // Submit form with invalid email
     // Assert error message is displayed
   })
   ```

## Common Error Scenarios

### "Workspace not found"

**Cause**: User tries to access a workspace they're not a member of, or workspace doesn't exist.

**Handled by**: `workspaceProcedure` middleware in [packages/api/trpc/trpc.ts:117-184](../packages/api/trpc/trpc.ts)

**Frontend**: User is redirected or shown error page.

### "Unauthorized"

**Cause**: User is not authenticated or doesn't have required permissions.

**Handled by**: `enforceUserIsAuthed` middleware and role checks.

**Frontend**: User is redirected to login page.

### Validation errors

**Cause**: User submits invalid data.

**Handled by**: Zod schemas in tRPC procedures.

**Frontend**: Errors displayed inline in forms or via toast.

### Database constraint violations

**Cause**: Unique constraint violation, foreign key violation, etc.

**Backend**: Caught in service layer and converted to appropriate `ServiceError`.

**Frontend**: Displayed as user-friendly message via toast.

### Network errors

**Cause**: Request timeout, network disconnection, server unreachable.

**Handled by**: tRPC client automatically, TanStack Query retries.

**Frontend**: Show error state with retry button.
