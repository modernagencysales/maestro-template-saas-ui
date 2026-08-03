# Delivery Receipts

Fast checks for the delivery claims in
[`delivery-story.md`](./delivery-story.md).

## Fresh Clone Setup

If the checkout is shallow, fetch enough history before inspecting commit
ranges:

```bash
git fetch --deepen=250 origin main
```

## Local Git Receipts

The historical CI hardening sequence that turned the former hosted Buildkite
pipeline from template shape into bare-agent reality is inspectable in this
range:

```bash
git log --reverse --date=short --pretty=format:'%h %ad %s%n%b%n---' e454046d3^..2e15e7094
```

Anchor commits:

| Commit      | Receipt                                                   |
| ----------- | --------------------------------------------------------- |
| `e454046d3` | Buildkite hosted queues and cluster secrets wired.        |
| `329cfeb04` | Bare hosted agents bootstrap Node and pnpm.               |
| `eecc7fc1e` | pnpm binary and gitleaks pinned after hosted-agent drift. |
| `1952093fb` | In-workspace pnpm store ignored by tree-walking gates.    |
| `4e2f1dfbe` | Toolchain bootstrap excluded from script unit-test pins.  |
| `4a5b58311` | Coverage baseline reset to the Linux CI-measured floor.   |
| `fd9a5c711` | PR-health gates receive the `GITHUB_TOKEN` they require.  |
| `2e15e7094` | Cloudflare deploy secrets namespaced for this pipeline.   |

The mutation-gate red-to-green receipt is this shorter range:

```bash
git log --reverse --date=short --pretty=format:'%h %ad %s%n%b%n---' 7958a95f0^..ffb832c71
```

Anchor commits:

| Commit      | Receipt                                                  |
| ----------- | -------------------------------------------------------- |
| `7958a95f0` | Coverage ratchet widened across Convex and web packages. |
| `020d7e4b9` | Stryker mutation config made runnable.                   |
| `ffb832c71` | Stryker sandbox and Wrangler state dirs ignored.         |

Agent-delivery provenance is visible through commit trailers:

```bash
git log --all --format='%h %an <%ae>%n%B%n---' \
  --grep='Co-Authored-By: Claude' --fixed-strings --max-count=20
```

The current gate shape is local and credential-free:

```bash
rg -n "ci-self-protection|phase-1|taste|contract-review|staging-deploy|production-promote" \
  .woodpecker tooling/ci
```

## Historical Buildkite Receipts

These receipts predate the Woodpecker migration and are retained only as
historical evidence; they are not an active release surface.

```bash
bk build view -p mas/maestro-template 23 --no-pager --text
bk build view -p mas/maestro-template 25 --no-pager --text
bk build view -p mas/maestro-template 88 --no-pager --text
```

Known anchors:

| Build                                                                     | Result | Receipt                                                                                              |
| ------------------------------------------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------- |
| [`#23`](https://buildkite.com/mas/maestro-template/builds/23)             | failed | First mutation run: deterministic, taste, contract, and staging passed; mutation failed.             |
| [`#25`](https://buildkite.com/mas/maestro-template/builds/25)             | passed | Validated mutation config: deterministic, taste, contract, mutation, and staging passed.             |
| [`#88`](https://buildkite.com/mas/maestro-template/builds/88)             | passed | Current Effectification branch gate: phase-1 deterministic gates, taste, and contract review passed. |
| [`#2-#19`](https://buildkite.com/mas/maestro-template/builds?branch=main) | mixed  | Early hosted-pipeline red-build sequence; use the loop below to print each build summary.            |

To scan the early red-build sequence:

```bash
for n in 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 23 25; do
  bk build view -p mas/maestro-template "$n" --no-pager --text | sed -n '1,24p'
done
```

For current evidence, use the Woodpecker pipeline and logs:

```bash
headless-bws-env exec sh -c 'WOODPECKER_TOKEN="$WOODPECKER_API_TOKEN" woodpecker-cli pipeline ps modernagencysales/maestro-template-saas-ui'
```
