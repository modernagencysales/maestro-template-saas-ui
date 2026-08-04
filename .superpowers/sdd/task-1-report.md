# Task 1 remediation report

## Outcome

Closed the four latest W0 review blockers.

1. Bubblewrap now uses `--clearenv` and explicit `--setenv` entries only. The
   immutable runner rejects every unexpected environment variable and an escaped
   working directory. CPU/file limits use `prlimit`; Node heap is capped because
   Bubblewrap 0.8 has no rlimit flags and Node cannot start Undici under a low
   virtual-address limit.
2. GitHub rulesets and Woodpecker repository metadata now have strict provider
   response schemas. Protected producer/secret-reference state is explicitly a
   separate `maestro.protected-ci/v1` controller contract, not an invented
   Woodpecker endpoint. Missing contract version/URL/token or malformed bodies
   fail before a write. Arbitrary adapter modules remain rejected.
3. Every transition document records pending, forward-written, forward-verified,
   inverse-written, or inverse-verified progress. The journal is atomically
   persisted after each write/read. A restart test proves rollback from a mixed
   state where GitHub was updated and Woodpecker had not been.
4. The image entrypoint is a fixed dispatcher that orchestrates the embedded
   dependency proxy and sandbox. Its real canary creates an empty locked app,
   proves no environment inheritance, proves direct registry egress fails,
   reaches only the Unix-socket proxy bridge, and completes pnpm fetch plus
   offline install.

The candidate network is always unshared. There is no `--share-net` mode.

## Files

- `tooling/ci/protected-bootstrap.mts`
- `tooling/ci/protected-bootstrap.test.mts`
- `tooling/ci/candidate-sandbox.mts`
- `tooling/ci/candidate-sandbox.test.mts`
- `tooling/ci/controller-runtime.mjs`
- `tooling/ci/controller.Dockerfile`
- `tooling/ci/sandbox-runner.mjs`
- `docs/template/protected-ci-bootstrap.md`

The earlier dependency-proxy hardening remains in commit `a46f5f6a4`. The three
unrelated deleted Confect fixture files remain unstaged.

## Verification

```text
HOST_TEST_SLOT_ACTIVE=1 pnpm exec vitest run tooling/ci/protected-bootstrap.test.mts --maxWorkers=1 --no-file-parallelism --testTimeout=30000
PASS: 1 file, 15 tests

HOST_TEST_SLOT_ACTIVE=1 pnpm exec vitest run tooling/ci/candidate-sandbox.test.mts tooling/ci/dependency-proxy.test.mts tooling/quality/check-ci-completeness.test.mts tooling/quality/woodpecker-template-pipeline.test.mts --maxWorkers=1 --no-file-parallelism --testTimeout=30000
PASS: 4 files, 26 tests

pnpm exec tsc --noEmit --target ES2022 --module nodenext --moduleResolution nodenext --allowImportingTsExtensions --types node,vitest/globals --skipLibCheck <six W0 TypeScript files>
PASS

pnpm exec eslint <changed W0 source/test files>
PASS

pnpm exec prettier --check <changed W0 source/test/docs files>
PASS

git diff --check
PASS
```

## Real controller image canary

```text
docker build -f tooling/ci/controller.Dockerfile -t maestro-w0-controller:canary .
PASS: local manifest list sha256:7444943921b8ab3875ab991d266ebfee31da99b78eeeda4092e5a5dcab4ede62

docker run --rm --privileged maestro-w0-controller:canary canary
PASS:
  dependency proxy listening on /controller/proxy/dependency.sock
  Already up to date
  Done in 651ms using pnpm v10.12.1
  protected controller canary passed
```

OrbStack required `--privileged` to permit nested user/mount namespaces. The
candidate itself still creates its own user, PID, IPC, UTS, cgroup, and network
namespaces and receives only the immutable runtime, candidate workspace, proc,
dev, tmpfs, and proxy socket directory. The production Woodpecker agent must run
the same canary with its narrower native user-namespace policy before the image
digest is published.

## External cutover prerequisite

Source behavior is deterministic and tested, but no external transition was
performed. The deployed protected controller service must advertise and satisfy
`maestro.protected-ci/v1` at the documented `/v1/repositories/...` resources.
Read-only observe must pass against that deployment and the Woodpecker agent
must pass the image canary before temporary trust-floor installation. The
operator now fails closed instead of pretending unsupported Woodpecker producer
routes exist.
