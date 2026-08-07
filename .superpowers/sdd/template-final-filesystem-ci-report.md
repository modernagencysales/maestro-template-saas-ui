# Final filesystem CI timeout report

## Outcome

The final materialized customer filesystem audit retains both offline installs,
the real alpha.2 materialization and filesystem/security audit, all six compile
and static gates, the TanStack compatibility seam, and the final web build. The
six independent compile/static commands now run with a hard concurrency limit of
two. Results are collected and the lowest command-index failure is rethrown, so
failure selection remains deterministic even when a later command settles first.

Base: `8e76abdcec55359f2ab7b1a7763f72d52c6a4001` (`origin/main` when the
worktree was created). Verified implementation tree before this report was
added: `e96f1dc7cedfc9d1da50f115099090825c04f9db`. The final carrier commit is
reported in the agent handoff because a commit cannot contain its own SHA.

## Root cause and known-green comparison

Woodpecker pipeline 146 passed at known-green head
`85ca4981473553cf673249c2275a15fdf163b835`, but the cold-cache audit already
needed 101.384 seconds of its 120-second test budget. Failing pipeline 156 at
`70304f6759431f5517795883a957afad4b35a550` timed out at 120.011 seconds.
Pipelines 147 and 152 ran the same audit in 91.464 and 89.722 seconds; pipelines
155 and 156 exceeded 120 seconds.

The release test, helper, package scripts, root package and lockfile, immutable
release tag, Woodpecker verify workflow, and CI setup are byte-identical between
the known-green and failing heads. Their only tree differences are unrelated
generator blueprint/lint files, which the test cannot reach after cloning and
detaching `maestro-template-v0.2.0-alpha.2`.

Temporary boundary timing on an unpublished diagnostic commit measured:

- release install: 8.111s
- real customer materialization: 10.031s
- final target install: 4.207s
- CLI typecheck: 5.183s
- generator typecheck: 2.506s
- workflow policy check: 2.601s
- workflow principal check: 3.334s
- Convex typecheck: 25.896s
- web typecheck: 17.533s
- web build: 12.197s
- complete compile-gate phase: 73.481s

The six compile/static commands alone consumed 57.053 seconds serially. That
unnecessary serialization left only 12-19 seconds of headroom on normal green
cold runs, so ordinary runner variance crossed the existing timeout. The
temporary timing instrumentation was removed before the final change.

## TDD evidence

RED, on test-only commit `903f28f341018fbb61442462cb60878014360233`:

```text
rtk maestro-remote-test -- pnpm --dir tooling/release exec vitest run src/customerTarget/finalFilesystem.test-support.test.ts --passWithNoTests --maxWorkers=1 --no-file-parallelism

1 failed, 9 passed
expected max active compile commands 2; received 1
```

The companion characterization for deterministic first-declared failure was
green before the scheduler changed.

GREEN, on implementation tree `e96f1dc7cedfc9d1da50f115099090825c04f9db`:

```text
rtk maestro-remote-test -- pnpm --dir tooling/release exec vitest run src/customerTarget/finalFilesystem.test-support.test.ts --passWithNoTests --maxWorkers=1 --no-file-parallelism

1 file passed, 10 tests passed, 2.36s
```

History-complete cold-cache proof (the disposable remote checkout explicitly
fetches the immutable tag because the remote-test bundle contains `HEAD` only):

```text
rtk maestro-remote-test -- bash -lc 'rtk git fetch --quiet https://github.com/modernagencysales/maestro-template-saas-ui.git refs/tags/maestro-template-v0.2.0-alpha.2:refs/tags/maestro-template-v0.2.0-alpha.2 && rtk /usr/bin/time -p pnpm --dir tooling/release test:final-filesystem'

2 tests passed
audit: 77.743s
suite: 78.34s
wall: 79.66s
```

The unchanged base under the same command took 107.549 seconds for the audit and
109.15 seconds wall time. The bounded scheduler recovered 29.806 seconds inside
the test and restored roughly 42 seconds of timeout headroom without raising the
timeout or removing a proof.

Related checks:

```text
pnpm --dir tooling/release test:unit
33 files passed, 347 tests passed, 12.38s

pnpm --dir tooling/release typecheck
passed

pnpm exec eslint tooling/release/src/customerTarget/finalFilesystem.test-support.ts tooling/release/src/customerTarget/finalFilesystem.test-support.test.ts
passed

pnpm exec prettier --check tooling/release/src/customerTarget/finalFilesystem.test-support.ts tooling/release/src/customerTarget/finalFilesystem.test-support.test.ts
passed

git diff --check
passed
```

## Files

- `tooling/release/src/customerTarget/finalFilesystem.test-support.ts`
- `tooling/release/src/customerTarget/finalFilesystem.test-support.test.ts`
- `.superpowers/sdd/template-final-filesystem-ci-report.md`

## Concerns and boundaries

- The repository fake preflight is independently red on the local host because
  its Node version is unsupported; CI and remote verification use Node 22.
- `.woodpecker/firewall.yml` still has the reported schema warning for its
  top-level `timeout`. It is unrelated to the release-test hot path and was not
  changed.
- No full verify was run, per the task boundary. No push, PR, CI trigger, merge,
  deploy, tmux message, Fabro action, or runtime mutation was performed.
- The concurrency ceiling is deliberately two, not unbounded. Installs and the
  web build remain sequential around the compile phase, and error selection is
  regression-tested for deterministic output.
