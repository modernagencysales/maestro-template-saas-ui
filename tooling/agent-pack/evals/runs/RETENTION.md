# Agent-pack evaluation run retention

Run directories contain only redacted host output, redacted synthetic results,
canonical evidence hashes, verdicts, and receipts. The clean-clone workspace and
per-run host session directory are deleted at the end of every pass or failure.
Host processes receive a strict environment allowlist, never ambient Convex,
cloud, or API credentials.

This policy applies to walking-skeleton runs and every host-bound forward
scenario. Forward runs use one disposable detached clone per frozen scenario;
the run receipt retains the closed evidence records and per-scenario verdicts,
not the workspaces or raw host output.

- Passed runs: remove after 14 days.
- Failed runs: retain until the defect is attributed and repaired, no longer
  than 30 days.
- Keep only the redacted receipt and grader result when longer-lived evidence is
  required.
