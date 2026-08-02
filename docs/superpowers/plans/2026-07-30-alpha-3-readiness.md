# Alpha.3 Readiness

## Candidate Identity

- Version: `0.2.0-alpha.3`
- Tag: `maestro-template-v0.2.0-alpha.3`
- Release directory: `releases/v0.2.0-alpha.3`
- Public default: remains `0.2.0-alpha.2`

The release planner derives the alpha.3 identity without writing files and
rejects attempts to reseal the immutable public default. No alpha.3 release
directory or tag is created by this readiness work.

## Authorized Later Sequence

1. Merge the exact candidate head.
2. Run connected Convex generation and broad exact-head verification in the
   controlled release lane.
3. Seal alpha.3 from the exact clean commit.
4. Publish the immutable tag and archive.
5. Verify tag resolution, archive and manifest checksums, and untouched customer
   materialization from the published tag.
6. Review a separate production composition and quickstart default change.
7. Run the untouched-create acceptance again against the published tag.

## Stop Conditions

- Do not seal, publish, tag, deploy, or create `releases/v0.2.0-alpha.3` without
  explicit release authority.
- Do not change `ALPHA_2_SOURCE` or the quickstart default before the published
  alpha.3 tag passes untouched materialization.
- Do not report connected or broad gates green until the controlled lane runs
  them on the exact candidate head.
