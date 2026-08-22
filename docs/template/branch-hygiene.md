# Branch Hygiene And Recovery

Branch cleanup is a reviewed recovery operation. It must never be used to choose
product or deployment authority.

## Authority

- `main` is the template factory's canonical development branch.
- Immutable `maestro-template-v*` tags are template release authority.
- A customer application is canonical only from its own repository and valid
  `template-instance.json` bound to an immutable template release.
- Factory `product/*`, `demo/*`, and `codex/*` branches are never canonical
  customer applications.
- A successful build, familiar route text, or a matching screenshot does not
  override repository and release identity.

## Inventory

Refresh remote refs, then generate a read-only proposal:

```bash
rtk git fetch --prune origin
rtk pnpm branch:hygiene -- --remote origin --base main --stale-days 30
```

To retain a review artifact, provide an explicit repository-relative path:

```bash
rtk pnpm branch:hygiene -- --write artifacts/branch-hygiene/review.json
```

The manifest has `deletionEnabled: false`. The command cannot tag or delete a
branch. It classifies a branch as `review-delete` only when it is both merged
into the selected base and older than the selected threshold. Protected,
canonical, and recent branches stay `keep`. A stale unmerged branch becomes
`review-archive`: it needs an explicit supersession review before its recovery
tag can justify deletion.

The inventory is only a proposal. `review-archive` is not a weaker spelling of
`review-delete`: a reviewer must identify where its intended changes landed or
record why they were abandoned. Before approval, review open pull requests,
worktrees, deployment references, branch-specific environments, and commits that
are not reachable from the base.

## Recovery Tags

Create one annotated recovery tag for each unique candidate commit, not one tag
per branch. The manifest groups branches that share a commit and proposes an
`archive/branch-cleanup-YYYYMMDD-<sha>` tag.

Before deleting any branch:

1. Verify the proposed commit still matches the remote branch.
2. Create and push the proposed annotated recovery tag.
3. Verify the pushed tag resolves to the exact commit.
4. Record the approving reviewer and recovery tag in the cleanup receipt.
5. Delete only the exact reviewed remote branch name.
6. Regenerate the inventory and confirm canonical and protected branches remain.

If any commit, pull request, deployment, or worktree changed after review,
discard the approval and generate a fresh manifest.

## Repository Rules

The GitHub ruleset for `main` should require:

- pull requests rather than direct pushes;
- the repository's authoritative verification and provenance checks;
- resolved review conversations;
- dismissal of stale approvals after material changes;
- linear history where compatible with the selected merge strategy; and
- administrator enforcement except for a separately audited recovery path.

Automatic deletion after merge may remain enabled. Scheduled hygiene should open
or refresh a review artifact; it must not delete branches automatically.
