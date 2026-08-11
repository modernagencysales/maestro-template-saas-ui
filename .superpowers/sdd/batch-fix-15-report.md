# Batch Fix 15 Report

## Implementation

Updated `apps/web/scripts/check-dev-runtime-longevity.test.mjs` only. The test
now allocates a loopback TCP port with Node's `node:net` `createServer`, binds
port `0`, reads the assigned `address().port`, and closes the allocation
server before passing the port to the existing `checkDevRuntimeLongevity`
helper. Production code and its strict-port launch behavior are unchanged.

## RED evidence

Before the change, the required focused test failed because the fixed port was
occupied:

```text
Error: Port 15183 is already in use
```

The test consequently failed after cleanup timed out waiting for the failed
child process to stop. The unrelated listener was not touched or signaled.

## GREEN evidence

The required focused test passed after the change:

```text
Test Files  1 passed (1)
Tests       1 passed (1)
```

The required static checks also passed:

- `rtk pnpm exec prettier --check apps/web/scripts/check-dev-runtime-longevity.test.mjs`
- `rtk git diff --check`

No broad verification was run.

## Files changed

- `apps/web/scripts/check-dev-runtime-longevity.test.mjs`
- `.superpowers/sdd/batch-fix-15-report.md`

## Self-review

- The production longevity helper is unchanged.
- The fixed global port assumption is removed from the test.
- Allocation uses only Node standard library APIs and closes cleanly.
- No dependencies, abstraction, retry framework, or unrelated files were added.

## Concerns

None.
