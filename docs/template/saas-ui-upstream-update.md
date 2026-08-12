# Updating the Pinned Saas UI Sources

Use this sequence for an upstream refresh:

1. Pin the reviewed template, Starter Kit, and Pro commits in
   `docs/template/saas-ui-upstream.json`.
2. Regenerate the Pro catalog and materialization receipt from the pinned
   registry; do not hand-maintain a second block list.
3. Reapply only route, service, fixture, semantic-role, and compatibility
   adapters.
4. Review every existing deviation; remove entries whose compatibility reason no
   longer applies and add concrete entries for new changes.
5. Generate a clean current customer target and verify the private paid-source
   boundary and preserved license notices.
6. Repeat focused typecheck/build, behavior, keyboard/accessibility, and paired
   reference/generated visual evidence.
7. Record the exact commands and results in the PR, then require
   `ci/woodpecker/pr/verify` on the immutable head before updating the pin.

An upstream update is not complete when it merely compiles: the owner reviews
the rendered reference and generated target using the golden-review runbook.
