# Focused tests persistent goal

## Objective

Provide fast, bounded, trustworthy validation for each candidate without
repeated broad CI. Serialize large jobs, capture exact evidence, and return
failures to the owning lane without editing product code.

## Plan

1. Create this objective as the session's persistent goal.
2. Read the committed control plan and each repository's gate instructions.
3. Maintain a queue of candidate commit, requested checks, start/end time, exit
   status, and log location.
4. Allow at most two focused jobs and one broad job at once.
5. Run one full required verification only on an immutable delivery candidate.
6. Report inherited baseline failures separately from candidate regressions.

## Constraints

- Do not edit product code or gate expectations.
- Do not rerun unchanged failing commands without a new hypothesis.
- Prefix every shell command with `rtk`.
