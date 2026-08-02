# How To Add A Notification

Use the notification generator:

```bash
pnpm template:add-notification -- --name workflowCompleted
```

## Files Created

- Notification schema.
- Provider dispatch capability.
- Fake/test provider fixture.
- Web notification surface using `TemplateNotificationCenter`.
- Email or webhook mapping when enabled.
- Tests and docs.

The template already ships the fake-safe center foundation:
`packages/notifications` owns notification records, in-app/email/digest
preferences, read-state planning, unread counts, and channel filtering.
`ops.notifications` persists durable in-app notification records and
per-recipient preferences in Confect, including workspace-member-scoped list,
mark-read, preference upsert, and internal record mutations. `/notifications`
renders through generated `ops.notifications` refs when Convex is configured and
falls back to a reference inbox without requiring live provider credentials.
Generated notifications should extend those contracts rather than creating a
second inbox model.

Email delivery uses the neutral `EmailProvider` contract. Add transactional
templates to `postmarkTemplates()` in `packages/integrations/src/emailSetup.ts`
and schedule `ops.email.sendTransactional` with a stable business idempotency
key after the owning mutation commits. Do not call Postmark from a mutation.

Marketing is separate from notification preferences: `ops.email.subscribe`
requires explicit opt-in evidence, `previewBroadcast` counts only current
non-suppressed subscribers, and `dispatchBroadcast` requires the exact `SEND`
confirmation. Never accept raw recipient lists for a broadcast. Run
`pnpm email:setup` after adding or changing a Postmark template alias.

## Tests

- workspace scope;
- unread/read state;
- delivery fake;
- provider failure;
- suppression or preference handling;
- audit event when required.

## Gates

- `pnpm --dir packages/convex test notifications`
- `pnpm --dir packages/notifications test`
- `pnpm --dir packages/integrations test`
- `pnpm check:confect-contracts`
