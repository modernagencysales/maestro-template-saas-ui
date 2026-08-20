# Morning Demo Status Ledger

Last controller update: 2026-08-20T01:26:00-04:00

| Lane          | State                          | Current evidence                                                                                                                   | Next gate                                           | Blocker                                                                                                                                       |
| ------------- | ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Controller    | active                         | Control branch pushed through `7a2bd0d`; proxy recovered on codex-lb `1.23.0`; all worker panes survived; T+0:30 gate passed       | T+2:00 foundation gate at 00:25                     | none                                                                                                                                          |
| Template      | evidence-ready                 | Immutable checkout clean at `13a33eee`; source/screen inventory and focused evidence packet admitted                               | Live revision/visual receipt                        | canonical head retains a stale vendored-source receipt; Worker build failed twice because isolated `fnm exec` omitted fake AuthKit values     |
| Social        | source-green-host-rejected     | Exact clean `393dd5cb7ee6` passed second-cycle `pnpm verify`; hosted/runtime/browser diagnosis is terminal and traffic is restored | New deploy-compatible exact candidate required      | generated Workerd `createRequire`; missing `__name`/hydration; signed-out demo reaches login; rollback `23fc85e0` remains 100%                |
| Owned Funnel  | artifact-green-not-provisioned | Exact clean `f4e3262af86d` passed its sole Worker build; artifact `be657eec...` is sealed; public Astro audit is green             | Owner provisions approved private bindings/session  | target Worker does not exist; four management bindings and separate WorkOS configuration are absent; no deployment or rollback version exists |
| Brain         | runtime-rejected-rolled-back   | Exact protected-main `2f6e167cc05f` passed Woodpecker `796` and deploy `797`; authenticated smoke failed at the app error boundary | New exact sidebar-context fix and deployment epoch  | candidate `e7d79bf4` rejected; rollback `30f8f677` restored at 100%; no edit/save proof admitted                                              |
| Focused tests | complete                       | Social verify, Brain pipeline `796`, and Owned Worker build terminal receipts are sealed; all broad work ran serially              | Return exact-head verdicts                          | none within the requested focused-test admission scope                                                                                        |
| Deploy/review | terminal-receipts-sealed       | URL matrix now records Social and Brain rollbacks plus Owned non-creation admission blocker; public Astro remains green            | Owner/new exact candidates or approved provisioning | no currently accepted candidate can be promoted: Social/Brain need new SHAs; Owned needs approved live bindings and WorkOS configuration      |

## Current review URLs

- Template: <https://maestro-template-saas-ui.tim-bb0.workers.dev>
- UI Lab: <https://maestro-template-saas-ui.tim-bb0.workers.dev/ui-lab>
- Storybook: <https://saas-ui-pro-storybook-review.tim-bb0.workers.dev>
- Social: <https://b2b-creator-os.tim-bb0.workers.dev>
- Owned Funnel public: <https://shop.maestrogtm.com/owned-funnel-builder/>
- Owned Funnel management: pending
- Brain: <https://staging.maestrogtm.com/brain>
- Dmitry:
  <https://meta-campaign-audit-prototype-production.up.railway.app/campaign-setup-audit>

## Controller log

- `2026-08-19T22:25-04:00`: Owner authorized full 12-hour execution.
- `2026-08-19T22:25-04:00`: Product changes remain unstarted until the durable
  control artifacts and lane goals are committed.
- `2026-08-19T22:31-04:00`: Control plan and task ledger pushed to
  `codex/morning-demo-execution-control`.
- `2026-08-19T22:32-04:00`: Observed eight live `morning-demo` windows and clean
  control head `a7a9af3`; required `pnpm maestro -- preflight --mode fake`
  failed with `tsx: not found` because control dependencies are absent.
- `2026-08-19T22:35-04:00`: Proved clean assigned heads and package-manager pins
  for Template `13a33eee` (`pnpm@10.12.1`), Social `65c4962` (`pnpm@10.12.1`),
  Owned Funnel `36396b0` (`pnpm@10.12.1`), and Brain `6e3727da` (`pnpm@9.15.4`).
- `2026-08-19T22:35-04:00`: Headless preservation snapshot was attempted
  read-only and failed exactly with
  `Permission denied (publickey,password,keyboard-interactive)`; the checklist
  item remains open.
- `2026-08-19T22:36-04:00`: Baseline HTTP sweep returned 200 after redirects for
  Template, UI Lab, Storybook, Social, public Owned Funnel, Brain auth redirect,
  and Dmitry.
- `2026-08-19T22:36-04:00`: Existing broad `pnpm verify` for immutable head
  `4df6286958b6` remained active in
  `/home/maestro/test-runs/20260820T023102Z-4df6286958b6-78718`; no second broad
  job was started.
- `2026-08-19T22:36-04:00`: Controller and all six worker lanes confirmed their
  committed persistent goals active; pane working directories matched lane
  ownership.
- `2026-08-19T22:37-04:00`: Re-snapshotted all headless tmux panes and dirty Git
  worktrees read-only through the existing dedicated `headless@headless`
  identity; OrbStack processes were live and no session or worktree was changed.
- `2026-08-19T22:38-04:00`: Worker defaults were confirmed as Node `v22.23.2`
  and pnpm `10.12.1`; `pnpm maestro -- preflight --mode fake` passed.
- `2026-08-19T22:39-04:00`: Supervisor reported removal of confirmed orphaned
  broad run `20260814T061539Z-6511ca715378-66388` (PPID 1, age 5d20h, stuck
  `pnpm clean-store fetch`). Current exact-head run
  `20260820T023102Z-4df6286958b6-78718` remains untouched as the sole broad job.
- `2026-08-19T22:39-04:00`: T+0:30 infrastructure gate passed early; next time
  gate is T+2:00 at `2026-08-20T00:25-04:00`.
- `2026-08-19T22:41-04:00`: Brain candidate
  `83ff67473e7ebc374654e2b8aef5bb246e4ec690` was committed and pushed; remote
  branch equality and a clean worktree were independently confirmed. Focused
  evidence: Brain 61 files/257 tests, shell/routes 4 files/13 tests, changed
  ESLint, and diff check all passed.
- `2026-08-19T22:42-04:00`: Inherited exact-head verify `4df62869` exited, but
  its external runner removed the temporary run directory before a result could
  be captured. Remaining Vitest belongs to Owned Funnel focused work, so the
  broad slot was released.
- `2026-08-19T22:42:51-04:00`: Focused Tests admitted clean Brain head
  `83ff67473e7e` for serialized `pnpm --dir apps/web typecheck` followed by
  `pnpm --dir apps/web build` only on typecheck success.
- `2026-08-19T22:44:21-04:00`: Brain `83ff67473e7e` passed serialized typecheck
  and build with exits `0`/`0`; final tree was clean at the same SHA. Receipt:
  `/data/projects/morning-demo-20260819/evidence/focused-tests/brain-83ff67473e7e-receipt.md`.
  The CSS optimizer warning for `::highlight(studio-pending-replacement)` is
  inherited, non-failing, and outside the candidate diff.
- `2026-08-19T22:45-04:00`: Brain candidate was admitted for guarded staging
  deployment and authenticated smoke; no deploy had been triggered at the time
  of admission.
- `2026-08-19T22:48-04:00`: Brain normal fast-forward was initially rejected by
  GH006 because `ci/woodpecker/pr/verify` was expected. Under explicit owner
  blocker-removal authority, Deploy/Review removed only that context, performed
  the non-force linear fast-forward `6e3727da..83ff6747`, and immediately
  restored the context.
- `2026-08-19T22:48-04:00`: Independent post-admission proof found remote `main`
  and `codex/morning-demo-brain-pro` both at `83ff6747`; required context
  `ci/woodpecker/pr/verify` restored; admin enforcement and linear history on;
  force pushes and deletions off. GitHub commit status was pending.
- `2026-08-19T22:48-04:00`: Template immutable evidence packet admitted from
  `/data/projects/morning-demo-20260819/evidence/template/lane-status.md`;
  canonical checkout remained clean at `13a33eee`. Focused checks passed; stale
  receipt and the two identical AuthKit prerender build failures remain exact
  inherited findings, and no third local build was authorized.
- `2026-08-19T22:49-04:00`: Brain Woodpecker epoch `793` failed verification
  cycle 1 because the manual clone lacked `origin/main` and the required
  `MAESTRO_CI_COMPLETENESS_TRUSTED_REF` input was unset. No product or gate code
  failed.
- `2026-08-19T22:51-04:00`: Brain verification cycle 2 epoch `794` was started
  with exact trusted ancestor `6e3727da5fedd7fdc75da1c22f2d1c418a0db415`. Clone
  and trusted-CI-policy passed; full verification is running on exact `main` SHA
  `83ff6747` without gate changes.
- `2026-08-19T22:51-04:00`: Social cycle 1 candidate `73a59ad` failed on a real
  Page-context regression; cycle 2 `1ee5810` proved that repair and failed on a
  non-exact heading selector. Owner authorized exactly one cycle 3 on clean
  `32dc26e`.
- `2026-08-19T22:53-04:00`: Social cycle 3 passed all five candidate route
  steps; command exit `1` came only from an inherited profile-wide `AfterAll`
  provider-call assertion not exercised by the route-only scenario. No fourth
  Cucumber cycle is authorized. The prior typecheck was recovered as green
  against its pinned immutable-source diagnostic baseline.
- `2026-08-19T22:57:10-04:00`: Brain epoch `794` terminated with verify exit `1`
  at `pnpm check:knip`: unused dependency `@saas-ui/chakra-preset` in
  `apps/web/package.json`.
  `git diff --exit-code 6e3727da..83ff6747 -- apps/web/package.json` returned
  `0`, proving the finding is inherited. No staging deploy occurred. Receipt:
  `/data/projects/morning-demo-20260819/evidence/focused-tests/brain-83ff67473e7e-woodpecker-794-failure.md`.
- `2026-08-19T22:58-04:00`: Brain stopped at the two-cycle boundary. No third
  cycle, dependency edit, or gate change is authorized until the owner chooses
  fix, defer, or remove; removing the Knip gate is not recommended.
- `2026-08-19T23:05:46-04:00`: Social exact local head `32dc26e6c3b6` completed
  `pnpm --dir apps/web build` with exit `0`; generated `.output` was moved
  recoverably to the focused-test evidence artifacts directory and the source
  checkout remained clean.
- `2026-08-19T23:09-04:00`: Owned Funnel candidate
  `465b8e2b450b92df925e6a34792c1d25d0c7bc81` was committed and pushed. The
  controller independently proved clean local/remote equality and no candidate
  diff to `.prettierignore`, generated product-contract/topology authority, the
  product plan, or public `apps/funnel` source.
- `2026-08-19T23:11:25-04:00`: Focused Tests mistakenly started Social
  `pnpm verify` before remote equality. The controller guard arrived during
  `check:format`; the lane terminated it at `23:12:18` with exit `130` and
  retained its hashed log only as invalid-admission evidence. It will not be
  retried until the exact remote branch exists.
- `2026-08-19T23:12-04:00`: Social's preserved pre-push hook rejected clean
  `32dc26e` at `typecheck:saas-ui`, reporting a proposal-view diagnostic and a
  `pnpm-lock.yaml` diagnostic-baseline hash mismatch. The remote branch remains
  absent while the owning lane classifies the clean-head finding.
- `2026-08-19T23:12:18-04:00`: Focused Tests admitted remote-equal Owned Funnel
  `465b8e2b450b` for its canonical web build. Brain's owner-authorized clean fix
  `e9337f50f2c4` is queued immediately afterward for its sole remaining local
  production build; neither candidate is being raced by another broad job.
- `2026-08-19T23:13-04:00`: codex-lb recovery was re-audited: all product/test
  panes survived. Deploy/Review alone hit an `Invalid previous_response_id`
  response-chain error; its existing pane and URL-matrix work were preserved and
  a goal-resume recovery was issued.
- `2026-08-19T23:13:23-04:00`: Owned Funnel exact pushed head `465b8e2b450b`
  passed the canonical `apps/web build` with exit `0`, including the client
  bundle budget and shell-copy checks. Its output was preserved under
  `evidence/focused-tests/artifacts/owned-funnel-465b8e2b450b-canonical-dist`;
  the separate Worker build and exact-head verification remain pending.
- `2026-08-19T23:14:44-04:00`: Brain clean local fix `e9337f50f2c4` passed its
  exact-head production build with exit `0`. The build log SHA-256 is
  `43a64dc1d8953ab47215957536d5c27e97ac1209b880b011730a194c7e55924a`; the only
  warning is the already-classified inherited non-failing
  `::highlight(studio-pending-replacement)` optimizer warning. Output was
  preserved in a candidate-specific evidence directory and the tree remained
  clean.
- `2026-08-19T23:15-04:00`: Deploy/Review recovered in the same tmux pane via a
  fresh response chain and began recreating its exact persistent goal from the
  committed lane goal and durable queue/URL matrix. Brain then encountered the
  same response-chain error after its build completed; its pane was likewise
  preserved and recovered without repeating checks.
- `2026-08-19T23:16:08-04:00`: Owned Funnel Worker cycle 1 at exact clean,
  remote-equal `465b8e2b450b` failed with Rolldown `INVALID_OPTION` because
  `codeSplitting.includeDependenciesRecursively=false` was combined with
  effective `preserveEntrySignatures="strict"`. The Worker log SHA-256 is
  `561cfd64a359930dd9c3a61c9161108ebb7cc24a9517003b153994c2a46b4b68`; the
  canonical build remained green with log SHA-256
  `906f0d874d8da411f767c57a690b708b4b39e1e74e47b46618b7eef8e1dc8ee3`.
- `2026-08-19T23:18:48-04:00`: Owned Funnel's authorized one-fix re-review at
  clean pushed `8b8b228628f59ae5e39ba599fa8783a1da23fa94` failed the same
  effective strict-signature conflict; Rolldown also warned the attempted
  `preserveEntrySignatures` key was invalid at its configured output location.
  This is the second failed Worker cycle. No full verify or deploy ran, and no
  third cycle is authorized without an explicit owner fix/defer/remove choice.
- `2026-08-19T23:18-04:00`: Brain candidate branch and protected `main` were
  independently confirmed at exact `e9337f50f2c4`. The fast-forward was linear
  and non-force; required context `ci/woodpecker/pr/verify`, admin enforcement,
  linear history, force-push prohibition, and deletion prohibition were all
  restored or unchanged. Commit status was pending.
- `2026-08-19T23:19-04:00`: Brain recovered authenticated Woodpecker access on
  headless by mapping the existing BWS-provided API-token name process-locally
  to the CLI's expected variable without printing or exporting the value.
  Pipeline listing succeeded; the sole broad slot was released to Brain for its
  one guarded exact-SHA cycle.
- `2026-08-19T23:19:25-04:00`: Brain Woodpecker pipeline `795` started for exact
  protected-main SHA `e9337f50f2c43998b1ab7fd58bd5183fb152c79c` with trusted
  completeness ancestor `83ff67473e7ebc374654e2b8aef5bb246e4ec690`. Clone and
  trusted-CI policy passed; full verification is running as the sole broad job.
  The staging gate remains closed pending a terminal success.
- `2026-08-19T23:18:48-04:00`: Focused Tests finalized the Owned Funnel
  second-cycle receipt. Exact Worker log SHA-256 is
  `6a1481ea3b197d4cb059ce1b6d273f59a68a404b4c1534a79fc38ecd9ff4492b`; failed
  output is preserved at
  `evidence/focused-tests/artifacts/owned-funnel-8b8b228628f5-worker-failed-dist`.
  Receipt:
  `/data/projects/morning-demo-20260819/evidence/focused-tests/owned-funnel-8b8b228628f5-failure.md`.
- `2026-08-19T23:21-04:00`: Social's bounded hook repair was committed and
  pushed at exact clean `4495a4f3d63da1cb9041c69c448dcc44fe81c437`; local and
  remote branch match. Preserved pre-push hooks passed, including the Saas UI
  diagnostic-baseline gate, and the focused proposal composition suite is 7/7.
  Exact-head admission is queued behind active Brain pipeline `795`; no fourth
  Cucumber cycle or duplicate parent checks are authorized.
- `2026-08-19T23:25-04:00`: Owner authorized one third/final Owned Funnel Worker
  cycle. Exact clean local/remote successor
  `3630bcf55acd81c7b392a2d7ff0fa338e5b30176` omits application custom
  `rolldownOptions` only in Worker mode while preserving canonical mode. The
  resolved Worker configuration reports no custom code-splitting policy; focused
  resolved-config regression 4/4, ESLint, Prettier, web typecheck, and normal
  hooks passed. Exactly one `build:worker` is queued behind Brain `795`, with no
  retry if it fails.
- `2026-08-19T23:36:39-04:00`: Brain Woodpecker `795` terminated before deploy.
  Clone, trusted policy, repaired Knip (`156/161`, resolved `5`), subsequent
  gates, sharded lint, and evals passed. `@maestro/web#typecheck` failed TS2322
  on `GridList.Root interactive` and `Persona.Root size` in source files
  unchanged from both rollback and parent. Exact `e9337f50` changes only
  `apps/web/package.json` and `pnpm-lock.yaml`; staging remains at rollback
  `6e3727da5fedd7fdc75da1c22f2d1c418a0db415`. No deploy, authenticated smoke, or
  rerun followed. Receipt:
  `/data/projects/morning-demo-20260819/evidence/focused-tests/brain-e9337f50f2c4-woodpecker-795-failure.md`.
- `2026-08-19T23:37:55-04:00`: Focused Tests admitted Social exact clean,
  remote-equal `4495a4f3d63da1cb9041c69c448dcc44fe81c437` for its one-time
  `pnpm verify` as the sole broad job. This admission started before the Owned
  final-cycle priority reached the lane; the running deterministic gate was
  preserved. Owned `3630bcf55acd` remains next for exactly one Worker build,
  with no overlap or retry.
- `2026-08-19T23:57:09-04:00`: Social exact-head `pnpm verify` terminated exit
  `1`. Formatting, lint, typechecks, strict Effect diagnostics, all package and
  tooling tests, and the production build passed. `check:env-boundary` then
  rejected the candidate-introduced direct `import.meta.env` read at
  `apps/web/src/features/demo/social-demo-fixtures.ts:12`. Log SHA-256 is
  `05bbcbcc6d89ef7d4fee9a3053db8c83f90094b07cb9fc73b5bb30a4d357df69`; receipt:
  `/data/projects/morning-demo-20260819/evidence/focused-tests/social-4495a4f3d63d-verify-receipt.md`.
  No fourth Cucumber or duplicate completed check ran.
- `2026-08-19T23:58:18-04:00`: Owned Funnel's owner-authorized third/final
  Worker build at exact clean, remote-equal `3630bcf55acd` terminated exit `1`.
  The prior Rolldown conflict was cleared; client and Worker SSR bundles
  completed, emitting `dist/server/index.js`. Prerender failed after three
  internal fetch attempts because the TanStack preview plugin imported absent
  `dist/server/server.js`. Preserved log SHA-256 is
  `807ce089b7efd8930f725d7f40ac759ef07c6237bfcee71b313964abbbeb3797` and
  artifact SHA-256 is
  `82e29d939e494c90e87000095ef1edad89f82501d7ea23cc96038ff1498dca02`; receipt:
  `/data/projects/morning-demo-20260819/evidence/focused-tests/owned-funnel-3630bcf55acd-final-worker-failure.md`.
  No retry, full verify, or deploy is authorized on this candidate.
- `2026-08-20T00:00-04:00`: Social's owning lane committed and pushed bounded
  env-boundary repair `393dd5cb7ee626a9a830c8e7a8571e432c345df9`. The focused
  boundary gate, ESLint, Prettier, diff check, 7 relevant tests, and preserved
  hooks pass; local and remote branch are exact. One replacement exact-head
  verification is queued with no fourth Cucumber or duplicate focused checks.
- `2026-08-20T00:00:33-04:00`: Brain replacement
  `2f6e167cc05ff35c04be32347390850cbe594a39` completed a fresh detached
  exact-head handoff. Frozen install, app typecheck, focused Pro shell/preset
  regressions (`3/3`), Knip (`156/161`, resolved `5`), and app build exit `0`;
  canonical component sources are byte-identical. The candidate branch is clean
  and remote-equal, while protected `main` remains
  `e9337f50f2c43998b1ab7fd58bd5183fb152c79c`. Receipt:
  `/data/projects/morning-demo-20260819/evidence/focused-tests/brain-2f6e167cc05f-repair-receipt.md`.
- `2026-08-20T00:02:14-04:00`: Focused Tests admitted Social replacement
  `393dd5cb7ee626a9a830c8e7a8571e432c345df9` for the single second-cycle
  exact-head `pnpm verify` as the sole broad job.
- `2026-08-20T00:04-04:00`: Owner authorized Brain replacement `2f6e167cc05f`
  for one new guarded cycle after Social releases the broad slot: linear
  protected-main advance with complete protection restoration, exactly one
  Woodpecker pipeline using the policy-valid trusted ancestor, and green-only
  staging plus authenticated `/brain` edit/save proof. No overlap is permitted.
- `2026-08-20T00:13:21-04:00`: Social exact clean, remote-equal replacement
  `393dd5cb7ee626a9a830c8e7a8571e432c345df9` completed its single second-cycle
  exact-head `pnpm verify` with exit `0`. The preserved log SHA-256 is
  `8442a226b5982c4b5e5c4a66f80d3cc9bde0d3069e91f7e683d799e755fc2490`; receipt:
  `/data/projects/morning-demo-20260819/evidence/focused-tests/social-393dd5cb7ee6-verify-pass.md`.
  No verification rerun, fourth Cucumber cycle, or duplicate focused check was
  used to seal the receipt.
- `2026-08-20T00:31:42-04:00`: Brain exact
  `2f6e167cc05ff35c04be32347390850cbe594a39` was admitted on protected `main` to
  one Woodpecker exact-head verification, pipeline `796`. At recovery handoff it
  remains the sole broad job under processes `1613500/1613501/1614045`; observe
  only, with no duplicate or overlap.
- `2026-08-20T00:52:19-04:00`: Focused Tests independently confirmed Owned
  Funnel exact clean local/remote equality at
  `f4e3262af86d1babe73f5bcff31a3e8598f15e62`. Its sole admitted command is Node
  `22.23.2` `apps/web build:worker`, queued after Brain pipeline `796` with a
  required preserved log hash and artifact. It has not started and cannot
  overlap the active Brain broad job.
- `2026-08-20T01:12:37-04:00`: Social recovery ended without a new deployment.
  Exact `393dd5cb7ee6` remains verify-green but is not browser-deployable:
  unmodified Worker SSR fails on generated `createRequire(import.meta.url)`; an
  evidence-only diagnostic substitution exposed missing `__name` and router
  invariants; a browser-only diagnostic shim then reached login rather than
  useful demo data and raised React hydration error `#418` on all five routes.
  Production remains at rollback version `23fc85e0...` with 100% traffic. No
  full verify or Cucumber rerun occurred. Receipt:
  `/data/projects/morning-demo-20260819/evidence/deploy-review/social-393dd5cb7ee6-exact-candidate-blocker.md`.
- `2026-08-20T01:12:26-04:00`: The supplied Brain verification processes had
  exited, and a read-only Woodpecker query returned terminal `success` for the
  sole guarded pipeline `796` on protected `main` exact
  `2f6e167cc05ff35c04be32347390850cbe594a39`. No duplicate pipeline or local
  verification ran. Receipt:
  `/data/projects/morning-demo-20260819/evidence/focused-tests/brain-2f6e167cc05f-woodpecker-796-pass.md`.
- `2026-08-20T01:13:19-04:00`: After Brain and the concurrently recorded Social
  recovery released their slots, Owned Funnel exact clean, remote-equal
  `f4e3262af86d1babe73f5bcff31a3e8598f15e62` passed its single Node `22.23.2`
  `apps/web build:worker` with exit `0`. Log SHA-256 is
  `6a4f8e81574c736e01aa651c4840700c45fc4650b555c0b7dc95a7d5698fc90a`; artifact
  SHA-256 is `be657eec5325a87d43b3768cc6c072812e72d1aff09a63e57e79139afb0bc0e4`.
  No overlap, retry, or full verify ran. Receipt:
  `/data/projects/morning-demo-20260819/evidence/focused-tests/owned-funnel-f4e3262af86d-worker-pass.md`.
- `2026-08-20T01:17:42-04:00`: Brain deploy pipeline `797` completed for exact
  protected-main `2f6e167cc05f`, publishing Worker version
  `e7d79bf4-4cef-4bd6-8dfe-14135e67b196` and Convex staging `utmost-bear-718`.
  Public `/brain` returned the expected `307` sign-in redirect. Fresh
  authenticated first-use then hit the application error boundary with
  `useSuiSidebarNavItemStyles returned is 'undefined'` before the editor, so no
  edit/save mutation was attempted. Staging was restored to
  `30f8f677-e999-423f-9654-0488ef2ee151` at 100% by rollback deployment
  `afdce4e0-b3f9-4ccf-b8dd-e0150bec515c`; duplicate pending pipeline `798` was
  canceled before execution. Receipt:
  `/data/projects/morning-demo-20260819/evidence/deploy-review/brain-2f6e167cc05f-deploy-runtime-rollback.md`.
- `2026-08-20T01:25:57-04:00`: Owned Funnel deployment admission stopped before
  Worker creation. Read-only Cloudflare queries returned code `10007` and
  confirmed `owned-funnel-management` does not exist; the authorized wrapper has
  no approved mapping for the four required management bindings or a separate
  WorkOS session configuration. There is therefore no Worker URL, version,
  timestamp, traffic, or rollback coordinate. No Brain credential was reused and
  the independently green public Astro deployment was unchanged. Receipt:
  `/data/projects/morning-demo-20260819/evidence/deploy-review/owned-funnel-f4e3262-deploy-blocker.md`.
