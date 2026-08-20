# Controller persistent goal

## Objective

Drive the entire committed 12-hour morning-demo plan to verified HTTP review
URLs. Monitor all lanes, update the central checklist only from evidence, keep
time gates visible, preserve existing headless sessions, and intervene only
when a lane is idle, drifting, or blocked.

## Working rules

- Create this objective as the session's persistent goal.
- Read the committed execution plan, checklist, status ledger, and all lane goals.
- Do not implement product code.
- Inspect pane output, branch activity, tests, host pressure, and deployment state.
- Give one bounded correction at a time; do not repeatedly interrupt productive work.
- Keep one large build/verification at a time across the worker.
- Update checklist and status ledger with exact commit, command, URL, or blocker evidence.
- At each deadline gate, choose the fallback in the committed plan if the primary path is late.
- Continue until every completion requirement is proved or an exact blocker remains.
