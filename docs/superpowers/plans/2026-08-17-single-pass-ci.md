# Single-pass CI implementation plan

1. Change the chassis regression first so it requires a CI-only uncovered-suite
   command and rejects the standalone runtime-longevity rerun.
2. Add the minimum root script, use it from `verify`, and remove the duplicate
   chassis command.
3. Update only the existing CI completeness authorities that encode those exact
   commands.
4. Run focused CI ownership checks, formatting, lint, and generated-file checks.
5. Commit, push once, and accept only exact-head Woodpecker success.
