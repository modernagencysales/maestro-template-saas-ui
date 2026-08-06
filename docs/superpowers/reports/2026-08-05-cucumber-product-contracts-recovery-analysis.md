# Cucumber Product Contracts Recovery Analysis

## Finding

The abandoned implementation optimized for proving that CI evidence was
trustworthy before it proved that the product worked. It completed Tasks
1-10/10b and entered Task 11, but the first real UI/CLI journey was Task 12. The
result was 111 commits of admission, identity, manifest, Messages, Pickle,
attestation, sandbox, and controller machinery with zero executable records
scenarios.

The product goal is smaller: a reviewed natural-language promise must fail until
a user can complete it through the generated app's real surfaces. Cucumber
already supplies the contract language, step binding, runner, and verdict.
Playwright and the Maestro CLI already supply the two drivers.

## Why The Work Expanded

Five different problems were treated as one system:

1. natural-language product acceptance;
2. malicious-pull-request containment;
3. CI admission and control-plane protection;
4. release and promotion authority;
5. evidence and attestation protocols.

Only the first problem belongs in this change. The others moved the first
observable product outcome behind controller provisioning, cryptography, runtime
manifests, receipts, and protected-agent infrastructure. Each review then
improved that new platform instead of questioning whether it should exist.

## Recovery Decision

Restart from current `origin/main` on one lean branch. Do not cherry-pick the
abandoned Tasks 1-10. Reuse the already-installed Cucumber, Gherkin, Playwright,
local-start, generated records, HTTP, CLI, and API-key primitives.

The first checkpoint is one walking skeleton:

```text
@required Feature
  UI creates a record
  CLI lists the same record
  both use one disposable local backend
  breaking Save record makes the scenario fail
```

That checkpoint precedes generalized commands, all remaining scenarios, factory
projection, documentation cleanup, or broad verification. If the walking
skeleton reveals that the proposed runtime boundary is wrong, change it while
the implementation is still small.

## Delivery Rule

Use one branch, at most four implementation commits, focused checks during
development, and one Woodpecker run at the frozen delivery head. Progress is
reported only as `0/4` through `4/4 scenarios`; completed infrastructure is not
counted as product progress.

## Non-goals

- malicious-PR security or a CI protection platform;
- controller, gateway daemon, broker, custom image, or new service;
- receipts, evidence stores, attestations, Messages/Pickle linkage, hashes of
  test artifacts, signing, HMAC, COSE, or Bubblewrap;
- runtime admission, reachability, release, cutover, tag, or publication work;
- Brain or Maestro product features;
- Graphite, stacked-PR, merge-queue, or CI orchestration redesign;
- a PR, full gate, or review swarm per task;
- generalized principal, operation, topology, or auth registries;
- production WorkOS login E2E, API-key management UI, or idempotency redesign;
- required screenshots, traces, or a persistent acceptance database;
- rewriting historical plans or release artifacts.

## Stop Conditions

Stop and simplify if the implementation appears to require a controller, daemon,
protocol, generalized auth framework, persistent acceptance store, new
dependency, or new long-running process beyond the existing local-start
children. None of those are prerequisites for a Cucumber prototype.
