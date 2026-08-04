# Token identifier and API principal migration

New users are keyed by the trusted issuer-bound `tokenIdentifier`, not a bare
subject. Backfill each existing user deterministically from its provider's
canonical `(issuer, subject)` pair before enabling the required field and
`by_token_identifier` index. API keys now derive workspace authority and scopes
exclusively from the hashed stored key row; caller workspace fields are
validated against that authority and never select it.

Run `httpAuthorization:backfillTokenIdentifiers` in batches of at most 100 with
trusted `userId`, `issuer`, and `subject` triples before deploying the required
field and index. The mutation refuses blank issuer/subject values,
stored-subject mismatches, and attempts to overwrite a different issuer-bound
identifier.
