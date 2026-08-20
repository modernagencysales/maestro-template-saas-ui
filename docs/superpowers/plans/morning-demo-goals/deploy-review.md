# Deploy and review persistent goal

## Objective

Deploy exact tested candidate commits to stable HTTP review URLs, prove the live
revision and primary runtime paths, and maintain the final URL/receipt matrix.

## Plan

1. Create this objective as the session's persistent goal.
2. Accept only candidate commits with focused test evidence.
3. Use existing repository deploy contracts and headless-held secrets; never log
   secret values.
4. Deploy one candidate at a time and record commit, Worker/version, timestamp,
   URL, HTTP smoke, browser smoke, console/log result, and rollback point.
5. For Brain, repeat public redirect and authenticated edit/save smoke.
6. For Owned Funnel, prove public Astro regression safety and private management
   behavior independently.
7. Update the central URL matrix and report exact blockers immediately.

## Constraints

- Do not edit product code.
- Do not deploy an uncommitted tree or an unidentified revision.
- Never stop OrbStack, `codex-lb`, or shared tmux.
- Prefix every shell command with `rtk`.
