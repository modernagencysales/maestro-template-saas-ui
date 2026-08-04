# Task 1 remediation report

## Outcome

Closed the reviewed W0 source blockers without changing the implementation plan.
The protected candidate launcher no longer has a shared-network mode. It uses an
unshared Bubblewrap network namespace and an immutable `socat` bridge to the
controller dependency proxy's fixed Unix socket. Package fetch and offline
install now run in one namespace so the tmpfs pnpm store survives.

The controller image now embeds the protected-bootstrap operator, the reviewed
allowlist, and a minimal immutable node/pnpm/socat runtime. Its fixed entrypoint
is `/controller/bin/protected-bootstrap`; arbitrary adapter modules are
rejected.

The transition journal now records an operation nonce, operator identity,
creation/expiry times, and consumed confirmations. Writes hold an exclusive
lock, confirmations are replay rejected, journal writes are atomic and mode
0600, and every preimage/postimage/post-read is bound to the observed
repository. The CLI derives transition documents from typed repository flags and
implements observe, install-temporary, enable-canonical, remove-temporary,
verify, and named-step rollback. A child-process test drives observe -> install
-> verify -> rollback against fake GitHub/Woodpecker HTTP servers.

## Files

- `tooling/ci/protected-bootstrap.mts`
- `tooling/ci/protected-bootstrap.test.mts`
- `tooling/ci/candidate-sandbox.mts`
- `tooling/ci/candidate-sandbox.test.mts`
- `tooling/ci/dependency-proxy.mts`
- `tooling/ci/dependency-proxy.test.mts`
- `tooling/ci/controller.Dockerfile`
- `tooling/ci/sandbox-runner.mjs`
- `docs/template/protected-ci-bootstrap.md`

The pre-existing dependency-proxy public-address hardening was retained. The
three unrelated deleted Confect fixture files were not staged.

## Verification

```text
HOST_TEST_SLOT_ACTIVE=1 pnpm exec vitest run tooling/ci/protected-bootstrap.test.mts --maxWorkers=1 --no-file-parallelism --testTimeout=30000
PASS: 1 file, 13 tests

HOST_TEST_SLOT_ACTIVE=1 pnpm exec vitest run tooling/ci/candidate-sandbox.test.mts tooling/ci/dependency-proxy.test.mts tooling/quality/check-ci-completeness.test.mts tooling/quality/woodpecker-template-pipeline.test.mts --maxWorkers=1 --no-file-parallelism --testTimeout=30000
PASS: 4 files, 26 tests

pnpm exec eslint <changed source/test files>
PASS

pnpm exec prettier --check <changed source/test/docs files>
PASS

git diff --check
PASS
```

Focused standalone TypeScript checking found and fixed the production readonly
journal cast and a test allowlist type. Re-run after commit is recommended as
part of review.

## Bounded Docker canary

Attempted twice:

```text
docker build --progress=plain -f tooling/ci/controller.Dockerfile -t maestro-w0-controller:canary .
```

The first attempt exposed and fixed an `ldd` header parsing bug. The second host
build remained in the base package-install layer for more than one minute and
was terminated by PID after the bounded attempt; no image was published and no
real Bubblewrap install canary was claimed. The immutable argv/runtime tests
fail closed, but the image must still be built and its actual candidate install
run on the Linux Woodpecker agent before external trust-floor installation.

## Remaining external concern

The typed fake API test proves routing, compare-and-swap, restart, replay, and
rollback behavior. The concrete server-side Woodpecker producer routes
(`/api/repos/<owner>/<repo>/producer` and secret-reference representation) still
need validation against the deployed protected controller/Woodpecker API before
any external write. Do not install the temporary trust floor until that live,
read-only observation and the Linux image canary both pass.
