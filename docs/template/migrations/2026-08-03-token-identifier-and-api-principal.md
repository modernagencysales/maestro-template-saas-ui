# Issuer-bound user identity and API principals

This migration is intentionally deployed in three steps; a required field and
new index cannot safely land over legacy rows in one deploy.

1. Deploy the current schema. `tokenIdentifier` is optional and
   `by_token_identifier` is staged. New users still write the trusted
   issuer-bound value. Runtime identity lookup temporarily uses `by_subject` and
   accepts only the row whose stored token identifier exactly matches the
   authenticated identity, so unbackfilled rows fail closed.
2. Run `httpAuthorization:backfillTokenIdentifiers` in batches of at most 100
   with trusted `userId`, `issuer`, and `subject` triples. The mutation refuses
   blank authority parts, stored-subject mismatches, and attempts to overwrite a
   different issuer-bound identifier. Wait for the staged index to report ready,
   then remove `staged: true`.
3. Switch identity reads to `by_token_identifier`, replace `UserRow` with the
   tested `RequiredUserRow` shape, remove `by_subject`, regenerate Confect, and
   deploy again. `token-identifier-migration.test.ts` pins both the currently
   optional shape and the final required-field contract.

API keys derive workspace authority and scopes exclusively from the hashed
stored key row. HTTP authorization re-reads the active key, workspace,
organization, creator, and memberships before running the operation; caller
workspace fields only validate that authority and never select it.
