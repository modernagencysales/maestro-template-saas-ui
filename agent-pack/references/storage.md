# Storage provider coaching reference

The validated file-import recipe works with bounded local bytes first. Add
object storage only when retained source files exceed the reviewed inline limit.

Use the canonical storage descriptor in
[`packages/integrations/src/index.ts`](../../packages/integrations/src/index.ts)
and the storage group in
[`docs/template/env-manifest.md`](../../docs/template/env-manifest.md). Those
authorities own required environment names, redaction, and fake/live posture;
this reference does not duplicate them.

Ask only whether source bytes must be retained, their maximum size, who may read
them, and the retention/delete rule. Keep local/fake storage working until those
answers, workspace-scoped signed access, rollback evidence, and secret-name-only
doctor output are reviewed. Never create a bucket, account, credential, or live
provider configuration automatically.
