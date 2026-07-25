# Walking-skeleton run retention

Run directories are synthetic, local evaluation evidence. They must never
contain credentials, provider state, or customer data. The harness redacts
captured host output and writes a deletion deadline into each run.

- Passed runs: remove after 14 days.
- Failed runs: retain until the defect is attributed and repaired, no longer
  than 30 days.
- Keep only the redacted receipt and grader result when longer-lived evidence is
  required.
