# Isolated Publication Tagged Authority Design

## Context

The Confect 10 and Effect 4 migration changes authored source that is also
listed in the tagged `publicationFixture` V1 source closure. The fixture is
explicitly marked `isolatedFixture: true`; it is publication-system evidence,
not an application workflow that the current candidate promises to resume.
Comparing that historical closure with the evolving worktree therefore reports
41 expected migration changes as immutable drift.

The existing worktree drift function remains the authority for ordinary
publications and direct drift tests. Published manifests, descriptors,
authorities, and release modules remain immutable and are not regenerated.

## Decision

The bounded publication-stack builder validates the historical isolated fixture
from its exact annotated Git tag:

- tag: `maestro-template-v0.2.0-alpha.1`;
- tag object: `d7fefbdcf2c30fb5c9e7b7d6c5b83c31c93e55f8`;
- peeled commit: `35c5bd1b1b011320f5790eca7bd1356174b20fc9`.

The implementation resolves the local tag, requires the exact annotated tag
object and peeled commit, and reads closure/artifact bytes from that commit.
Every tagged byte is recomputed against the checksums in the tagged descriptors
and manifest. Current immutable publication metadata is also compared with the
tagged bytes, so working-tree mutation of a descriptor, manifest, authority,
release module, generated publication document, or provenance file remains
visible as drift.

This path is permitted only when both tagged publication descriptors are
`published` and `isolatedFixture: true`. Any missing tag, moved tag, missing
blob, malformed authority, non-isolated descriptor, or checksum mismatch throws
a descriptive error. There is no worktree or regenerated fallback.

## Preserved Behavior

`findPublishedClosureDrift` is unchanged and continues to compare ordinary
publication inputs with current worktree bytes. Non-isolated publication code
therefore retains the existing fail-closed drift semantics.

No published manifest or checksum is rewritten. Authored Confect files are not
reclassified as generated. The change runs no Confect/Convex codegen and does
not alter a release, tag, public default, or deployment state.

## Verification

Focused regressions prove:

- the pinned isolated fixture stays clean while current authored source evolves;
- ordinary worktree drift remains observable;
- a missing or moved tag fails closed;
- a tagged checksum mismatch fails closed;
- immutable publication metadata still reports worktree drift.

The bounded gates are the single workflow-publication generator test, the
generator package typecheck, and the directly affected workflow-version
immutability test. No broad local gate is authorized.
