# Qlty maintainability baseline

Status: monitored debt from the initial Agent Pack import; new debt remains
visible through advisory Qlty reporting.

PR #5 introduces the productized Agent Pack as a 480-commit import against the
pre-productization `main` branch. Qlty Cloud caps its PR summary at 100 issues;
the authoritative local capture at integration head reported 459 maintainability
findings:

| Rule                  | Findings | Runtime rule/path pairs |
| --------------------- | -------: | ----------------------: |
| `boolean-logic`       |       83 |                      38 |
| `file-complexity`     |       26 |                      26 |
| `function-complexity` |      122 |                      57 |
| `function-parameters` |       22 |                       9 |
| `identical-code`      |      126 |                      18 |
| `nested-control-flow` |       21 |                       8 |
| `return-statements`   |       35 |                      18 |
| `similar-code`        |       24 |                      14 |

Thirteen findings are in immutable release payloads or generated example seed
source. Those copied artifacts are monitored for maintainability. Gitleaks also
runs through the independent deterministic secret gate; Qlty-hosted OSV output
remains advisory.

Qlty does not expose a repository-owned fingerprint baseline. The exact runtime
rule/path pairs present in this capture therefore use `set.mode = "monitor"` in
`.qlty/qlty.toml`. Global smell mode remains `block` inside Qlty so a rule in a
new path is emitted at finding severity; the repository wrapper still exits
successfully after reporting it. The entries are a debt ledger, not an exemption
for neighboring code.

## Deployment-authority launch ledger

The deployment-authority successor adds seven exact rule/path pairs that Qlty
reports against the release candidate: boolean logic, file complexity, function
complexity, return statements, and similar code in
`packages/convex/confect/deployAuthority/admin.ts`; file complexity in
`packages/convex/confect/deployAuthority/store.ts`; and boolean logic in
`scripts/_project-config.mjs`. The focused deployment-authority tests and the
combined 46-test candidate gate pass, so template maintainers own these pairs as
explicit launch debt while authorization behavior is kept stable.

Remove each pair as soon as a behavior-preserving extraction brings that rule
below its configured threshold. Proof requires the focused deployment-authority
tests, the configuration-drift tests for `_project-config.mjs`, and the commands
in the removal contract below. New rules or neighboring paths remain visible.

## Removal contract

When a listed path is refactored:

1. Run `qlty smells --all <path>` and the path's focused tests.
2. Remove the path from each rule list that is now clean.
3. Run `qlty config validate`, `qlty check --all --no-fix --fail-level=note`,
   and `qlty smells --upstream origin/main`.
4. Do not add a new path or rule to the ledger without a reviewed debt note that
   includes its removal owner and focused proof.
