# External-User Friction Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the repeatable day-zero, CLI discovery, machine-output,
generator-safety, generated-target integrity, and local-operations friction
reproduced from the external-user failure ledger.

**Architecture:** Extend the release line's existing preflight, scaffold,
customer materialization, verification receipt, and start-port boundaries. Add
only two new process entry points: an install-free bootstrap diagnostic and a
repository-owned Node launcher. Keep all checks deterministic, fake-safe,
serializable, and covered at the owning package boundary.

**Tech Stack:** Node.js 22 ESM, TypeScript 5.9, Vitest 3, Node's built-in test
runner, pnpm 10.12.1, Agent Pack command contracts, existing customer-release
tooling.

## Global Constraints

- Work from `maestro-template-v0.2.0-alpha.2` or its direct hardening
  descendant, not the older `main` line.
- Preserve existing interactive commands; change recommended automation commands
  only after the owned launcher exists.
- Fake/offline checks make no network request and never prompt for an account.
- Do not generalize Signal Scout-specific commands, cache behavior, providers,
  or branding.
- Do not claim production workflow durability beyond the compatibility ledger.
- Do not stop, restart, or reconfigure a process that owns a conflicting port.
- Every behavior change follows red-green-refactor and focused verification.
- Broad tests run only through `host-test-slot --class full`.

---

### Task 1: Install-free bootstrap and truthful package-manager preflight

**Files:**

- Create: `scripts/maestro-bootstrap.mjs`
- Create: `scripts/maestro-bootstrap.test.mjs`
- Modify: `package.json`
- Modify: `tooling/agent-pack/src/preflight.ts`
- Modify: `tooling/agent-pack/src/preflight.test.ts`
- Modify: `docs/template/quickstart.md`
- Modify: `docs/template/preflight.md`
- Modify: `README.md`

**Interfaces:**

- Produces: `inspectBootstrap(facts): BootstrapReport`
- Produces: `renderBootstrapHuman(report): string`
- Produces: `node scripts/maestro-bootstrap.mjs [--json]`
- Consumes: `.nvmrc` and `package.json#packageManager`
- Preserves: existing `PreflightFacts` schema

- [ ] **Step 1: Write failing bootstrap tests**

```js
import assert from "node:assert/strict";
import test from "node:test";
import {
  inspectBootstrap,
  renderBootstrapHuman,
} from "./maestro-bootstrap.mjs";

const ready = {
  nodeVersion: "v22.23.2",
  requiredNodeMajor: 22,
  pnpmVersion: "10.12.1",
  requiredPnpmVersion: "10.12.1",
  corepack: "ready",
  gitName: "Template User",
  gitEmail: "template@example.invalid",
};

test("recommends the pinned npx fallback when Corepack is unavailable", () => {
  const report = inspectBootstrap({ ...ready, corepack: "missing" });
  assert.equal(report.ok, true);
  assert.equal(
    report.installCommand,
    "npx --yes pnpm@10.12.1 install --frozen-lockfile",
  );
  assert.match(renderBootstrapHuman(report), /Corepack is unavailable/);
});

test("reports repository-local Git identity commands", () => {
  const report = inspectBootstrap({ ...ready, gitName: null, gitEmail: null });
  assert.equal(report.ok, false);
  assert.deepEqual(report.repairs.slice(-2), [
    'git config user.name "Your Name"',
    'git config user.email "you@example.com"',
  ]);
});

test("rejects an unsupported Node major before install", () => {
  const report = inspectBootstrap({ ...ready, nodeVersion: "v26.3.0" });
  assert.equal(report.ok, false);
  assert.match(report.diagnostics[0].message, /requires Node 22/);
});
```

- [ ] **Step 2: Run the bootstrap tests and verify RED**

Run:
`fnm exec --using=22.23.2 -- node --test scripts/maestro-bootstrap.test.mjs`

Expected: FAIL because `scripts/maestro-bootstrap.mjs` does not exist.

- [ ] **Step 3: Implement the pure bootstrap report and direct entry point**

```js
#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const safeExec = (file, args) => {
  try {
    return execFileSync(file, args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return null;
  }
};

export function inspectBootstrap(facts) {
  const nodeMajor = Number(/^v?(\d+)/.exec(facts.nodeVersion)?.[1]);
  const nodeReady = nodeMajor === facts.requiredNodeMajor;
  const pnpmReady = facts.pnpmVersion === facts.requiredPnpmVersion;
  const identityReady = Boolean(facts.gitName && facts.gitEmail);
  const installCommand =
    facts.corepack === "ready"
      ? `corepack pnpm@${facts.requiredPnpmVersion} install --frozen-lockfile`
      : `npx --yes pnpm@${facts.requiredPnpmVersion} install --frozen-lockfile`;
  const diagnostics = [
    ...(nodeReady
      ? []
      : [
          {
            code: "BOOTSTRAP_NODE_UNSUPPORTED",
            message: `Template requires Node ${facts.requiredNodeMajor}; found ${facts.nodeVersion}.`,
          },
        ]),
    ...(pnpmReady || facts.pnpmVersion === null
      ? []
      : [
          {
            code: "BOOTSTRAP_PNPM_UNSUPPORTED",
            message: `Template requires pnpm ${facts.requiredPnpmVersion}; found ${facts.pnpmVersion}.`,
          },
        ]),
    ...(identityReady
      ? []
      : [
          {
            code: "BOOTSTRAP_GIT_IDENTITY_MISSING",
            message: "Git author name and email are not configured.",
          },
        ]),
  ];
  return {
    ok: nodeReady && identityReady,
    installCommand,
    diagnostics,
    repairs: [
      ...(!nodeReady
        ? [`Install Node ${facts.requiredNodeMajor} and rerun this command.`]
        : []),
      installCommand,
      ...(identityReady
        ? []
        : [
            'git config user.name "Your Name"',
            'git config user.email "you@example.com"',
          ]),
    ],
    facts,
  };
}

export function renderBootstrapHuman(report) {
  const lines = [
    report.ok
      ? "Bootstrap prerequisites are ready."
      : "Bootstrap needs attention.",
  ];
  if (report.facts.corepack === "missing")
    lines.push("Corepack is unavailable; use the pinned npx fallback.");
  lines.push(
    ...report.diagnostics.map(({ code, message }) => `${code}: ${message}`),
  );
  lines.push("Next:", ...report.repairs.map((repair) => `  ${repair}`));
  return `${lines.join("\n")}\n`;
}

function runtimeFacts() {
  const packageJson = JSON.parse(
    readFileSync(new URL("../package.json", import.meta.url), "utf8"),
  );
  const requiredPnpmVersion = String(packageJson.packageManager).replace(
    /^pnpm@/,
    "",
  );
  return {
    nodeVersion: process.version,
    requiredNodeMajor: Number(
      readFileSync(new URL("../.nvmrc", import.meta.url), "utf8")
        .trim()
        .replace(/^v/, "")
        .split(".")[0],
    ),
    pnpmVersion: safeExec("pnpm", ["--version"]),
    requiredPnpmVersion,
    corepack:
      safeExec("corepack", ["--version"]) === null ? "missing" : "ready",
    gitName: safeExec("git", ["config", "--get", "user.name"]),
    gitEmail: safeExec("git", ["config", "--get", "user.email"]),
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const report = inspectBootstrap(runtimeFacts());
  process.stdout.write(
    process.argv.includes("--json")
      ? `${JSON.stringify(report, null, 2)}\n`
      : renderBootstrapHuman(report),
  );
  process.exitCode = report.ok ? 0 : 1;
}
```

- [ ] **Step 4: Make supported standalone pnpm independent of Corepack**

Add a preflight test asserting supported pnpm plus missing Corepack does not
emit `AGENT_PACK_PNPM_UNSUPPORTED`, then change the diagnostic condition to
`!facts.host.pnpm.supported`. When pnpm is unsupported, set the action to
`Run node scripts/maestro-bootstrap.mjs for the pinned Corepack or npx installation command.`

- [ ] **Step 5: Wire and document the bootstrap check**

Add `"test:bootstrap": "node --test scripts/maestro-bootstrap.test.mjs"` and
prefix `test:tooling` with `pnpm test:bootstrap &&`. Make
`node scripts/maestro-bootstrap.mjs` the first quickstart/README command and
show the exact `npx --yes pnpm@10.12.1 install --frozen-lockfile` fallback
beside Corepack.

- [ ] **Step 6: Verify GREEN and commit**

Run:

```bash
fnm exec --using=22.23.2 -- node --test scripts/maestro-bootstrap.test.mjs
fnm exec --using=22.23.2 -- pnpm --dir tooling/agent-pack test -- preflight.test.ts
fnm exec --using=22.23.2 -- pnpm exec prettier --check scripts/maestro-bootstrap.mjs scripts/maestro-bootstrap.test.mjs tooling/agent-pack/src/preflight.ts tooling/agent-pack/src/preflight.test.ts docs/template/quickstart.md docs/template/preflight.md README.md package.json
```

Expected: all focused tests pass; formatting exits 0.

Commit: `fix: make first-run bootstrap self-diagnosing`

---

### Task 2: Uniform help, strict parsing, and the owned launcher

**Files:**

- Create: `maestro-template.mjs`
- Create: `apps/cli/src/help.ts`
- Create: `apps/cli/src/launcher.test.ts`
- Create: `tooling/generators/src/help.ts`
- Modify: `apps/cli/src/commands.ts`
- Modify: `apps/cli/src/index.test.ts`
- Modify: `tooling/generators/src/index.ts`
- Modify: `tooling/generators/src/index.test.ts`
- Modify: `tooling/generators/src/blueprints/saasApplicationFactory.ts`
- Modify: `tooling/release/src/customerTarget/ownership.ts`
- Modify: `package.json`
- Modify: `README.md`
- Modify: `docs/template/quickstart.md`

**Interfaces:**

- Produces: `helpForSharedCommand(command): string | undefined`
- Produces: `helpForGenerator(command): string | undefined`
- Produces: `node maestro-template.mjs <args...>`
- Preserves: exact CLI child stdout, stderr, signal, and exit code

- [ ] **Step 1: Add failing CLI and generator help tests**

Add table-driven assertions that `workflow --help`, `workflow -h`,
`operations --help`, `api --help`, and `template:add-workflow -- --help` return
exit code 0 and usage text. Add a test that
`runGeneratorCli(["systems", "--query", "social", "sync"])` exits 1 with
`Quote multi-word queries`, while
`runGeneratorCli(["systems", "--query", "social sync"])` reports the complete
query.

- [ ] **Step 2: Run focused tests and verify RED**

Run:

```bash
fnm exec --using=22.23.2 -- pnpm --dir apps/cli test -- src/index.test.ts
fnm exec --using=22.23.2 -- pnpm --dir tooling/generators test -- src/index.test.ts
```

Expected: help and ambiguity assertions fail for the reproduced behavior.

- [ ] **Step 3: Centralize shared and generator help**

Export immutable usage maps from the new help modules. Match `--help` and `-h`
before required-argument parsing. In `parseArgs`, collect consumed flag/value
indexes and reject unconsumed tokens other than the command and `--` separator.
Return
`Ambiguous arguments after --query: sync. Quote multi-word queries, for example --query "social sync".`

- [ ] **Step 4: Write a failing owned-launcher integration test**

```ts
it("preserves clean JSON stdout and the CLI exit code", () => {
  const result = spawnSync(
    process.execPath,
    ["maestro-template.mjs", "describe"],
    {
      cwd: repositoryRoot,
      encoding: "utf8",
    },
  );
  expect(result.status).toBe(0);
  expect(() => JSON.parse(result.stdout)).not.toThrow();
  expect(result.stdout).not.toContain("> maestro-template@");
});
```

Also invoke an invalid command and assert exit code 1 and empty stdout.

- [ ] **Step 5: Implement the launcher and include it in customer targets**

```js
#!/usr/bin/env node
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const entry = fileURLToPath(
  new URL("./apps/cli/src/index.ts", import.meta.url),
);
const child = spawn(
  process.execPath,
  ["--import", "tsx", entry, ...process.argv.slice(2)],
  {
    cwd: process.cwd(),
    env: process.env,
    stdio: "inherit",
  },
);
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal));
}
child.on("error", () => {
  process.exitCode = 70;
});
child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exitCode = code ?? 70;
});
```

Classify `maestro-template.mjs` as template-owned, add it to generated target
closure assertions, and change JSON/automation examples to
`node maestro-template.mjs`.

- [ ] **Step 6: Verify GREEN and commit**

Run the two focused package tests, `node maestro-template.mjs describe | jq .`,
and a focused customer-closure test. Expected: all exit 0; malformed commands
retain their documented non-zero exit.

Commit: `fix: make CLI discovery and automation reliable`

---

### Task 3: Fingerprint the exact scaffold preview

**Files:**

- Modify: `tooling/agent-pack/src/scaffold.ts`
- Modify: `tooling/agent-pack/src/scaffold.test.ts`
- Modify: `apps/cli/src/factory/scaffold.ts`
- Modify: `apps/cli/src/factory/scaffold.test.ts`
- Modify: `tooling/generators/src/index.ts`
- Modify: `tooling/generators/src/index.test.ts`
- Modify: `docs/template/generator-output-contract.md`
- Modify: `docs/template/app-factory-guide.md`
- Modify: `AGENTS.md`

**Interfaces:**

- Adds: `ScaffoldInput.previewFingerprint?: "scaffold_sha256:${string}"`
- Adds to preview data: `privacy`, `previewFingerprint`, `confirmation.argv`
- Requires on write: matching preflight and preview fingerprints

- [ ] **Step 1: Add failing preview-contract tests**

Assert that a preview includes
`privacy: { classification: "review-required", secrets: "names-only" }`, a
stable `scaffold_sha256:` fingerprint, collisions, codegen, focused gates, and a
confirmation argv containing both fingerprints. Assert that changing one
argument or generated byte changes the fingerprint. Assert writes without the
preview fingerprint are blocked before `generators.run({ write: true })`.

- [ ] **Step 2: Verify RED**

Run:
`fnm exec --using=22.23.2 -- pnpm --dir tooling/agent-pack test -- src/scaffold.test.ts`

Expected: preview metadata and write-gate assertions fail.

- [ ] **Step 3: Implement stable preview hashing and confirmation data**

Use `createHash("sha256")` over a canonical JSON value containing generator ID,
args, paths, contents, collisions, semantic rule IDs, follow-up, codegen, and
focused gates. Add the preview fingerprint to `scaffoldData`; decode
`previewFingerprint`; require it on write; return the exact argv array rather
than an unsafe shell-interpolated string.

```ts
const fingerprint = `scaffold_sha256:${createHash("sha256")
  .update(JSON.stringify(canonicalPreview(input, output)))
  .digest("hex")}`;
```

- [ ] **Step 4: Update CLI parsing and direct-generator guidance**

Accept `--preview-fingerprint` in `maestro scaffold`. Direct generator help and
previews include the reviewed equivalent as structured data, but existing direct
command output fields remain compatible. Update the normal customer loop in docs
and `AGENTS.md` to use reviewed scaffold preview/write for consequential
changes.

- [ ] **Step 5: Verify GREEN and commit**

Run focused Agent Pack, CLI scaffold, and generator tests. Expected: stable
preview, changed-preview rejection, collision rejection, dirty-worktree
rejection, and successful exact write all pass.

Commit: `fix: bind scaffold writes to exact previews`

---

### Task 4: Validate generated workspace and documentation closure

**Files:**

- Create: `tooling/release/src/customerTarget/integrity.ts`
- Create: `tooling/release/src/customerTarget/integrity.test.ts`
- Modify: `tooling/release/src/customerTarget/materialize.ts`
- Modify: `tooling/release/src/customerTarget/materialize.test.ts`
- Modify: `apps/cli/src/factory/createRootIntegration.test.ts`
- Modify: `docs/template/agent-worker-playbook.md`
- Modify: `docs/template/how-this-relates-to-maestro.md`

**Interfaces:**

- Produces:
  `validateCustomerTargetIntegrity(files): CustomerTargetIntegrityFinding[]`
- Finding codes: `UNRESOLVED_WORKSPACE_DEPENDENCY`, `MISSING_DOCUMENT_REFERENCE`
- Materialization fails before writing when findings are non-empty

- [ ] **Step 1: Add failing validator tests**

Create in-memory fixtures with an app depending on
`@example/missing@workspace:*` and a generated Markdown instruction referencing
`repos/confect/CLAUDE.md`. Assert both stable findings. Add passing fixtures
where the workspace package and referenced document are present.

- [ ] **Step 2: Verify RED**

Run:
`fnm exec --using=22.23.2 -- pnpm --dir tooling/release test:unit -- src/customerTarget/integrity.test.ts`

Expected: missing module/function failure.

- [ ] **Step 3: Implement target-integrity validation**

Parse every target `package.json`, collect package names, and inspect
dependencies, devDependencies, optionalDependencies, and peerDependencies whose
specifier begins with `workspace:`. For Markdown and generated instruction
files, inspect backtick/link tokens beginning with approved repository-relative
roots (`apps/`, `packages/`, `tooling/`, `scripts/`, `docs/`, `repos/`,
`agent-patterns/`, `examples/`) and require a matching target file.

Return sorted, deduplicated findings; do not read outside the in-memory target
plan.

- [ ] **Step 4: Gate materialization and remove stale required vendored
      references**

Call the validator after target composition and before filesystem writes.
Replace required generated-target references to omitted `repos/effect` and
`repos/confect` paths with shipped canonical template docs. Keep factory-only
research docs unchanged when they are omitted from targets.

- [ ] **Step 5: Prove a fresh customer target is self-contained**

Extend the root integration test to assert zero integrity findings and run
`pnpm install --offline --frozen-lockfile --ignore-scripts` inside the
materialized target.

- [ ] **Step 6: Verify GREEN and commit**

Run focused release unit tests and `apps/cli` create-root integration through
`host-test-slot --class focused`. Expected: broken fixtures fail closed and the
canonical generated target installs offline.

Commit: `fix: close generated customer artifacts`

---

### Task 5: Distinguish generation freshness from reviewed working-tree drift

**Files:**

- Create: `tooling/quality/check-convex-generation.mts`
- Create: `tooling/quality/check-convex-generation.test.mts`
- Modify: `packages/convex/package.json`
- Modify: `package.json`
- Modify: `docs/template/confect-effect-guide.md`
- Modify: `docs/template/how-to-add-workflow.md`

**Interfaces:**

- Produces: `compareGeneratedSnapshots(before, after): readonly string[]`
- `check:convex` fails only if this invocation introduces generated changes
- Existing `check:generated-files` remains the committed-baseline release gate

- [ ] **Step 1: Add failing snapshot tests**

Cover clean output, codegen-introduced drift, and an already-reviewed
uncommitted generated diff that remains byte-identical across the command.
Assert only introduced drift fails.

- [ ] **Step 2: Verify RED**

Run:
`fnm exec --using=22.23.2 -- pnpm --dir tooling/quality test -- check-convex-generation.test.mts`

Expected: missing module failure.

- [ ] **Step 3: Implement bounded before/after hashing**

Hash sorted relative paths and bytes beneath
`packages/convex/confect/_generated` and `packages/convex/convex/_generated`,
run `confect codegen`, hash again, and report only changed paths. Reject
symlinks and files outside the two roots.

- [ ] **Step 4: Wire scripts and clarify docs**

Point package `check:convex` at the new checker. Keep the release gate that
compares generated output to the committed baseline under its explicit name.
Document offline Confect generation separately from live Convex deployment
generation and never recommend `convex dev` from fake mode.

- [ ] **Step 5: Verify GREEN and commit**

Run focused quality tests and `pnpm --dir packages/convex check:convex`.
Expected: both exit 0 with no new generated drift.

Commit: `fix: check codegen changes from current state`

---

### Task 6: Persist verification evidence and expose truthful readiness

**Files:**

- Modify: `tooling/agent-pack/src/verify.ts`
- Modify: `tooling/agent-pack/src/verify.test.ts`
- Modify: `apps/cli/src/factory/composition.ts`
- Modify: `apps/cli/src/factory/customerComposition.ts`
- Modify: `apps/cli/src/factory/verify.test.ts`
- Modify: `tooling/agent-pack/src/readiness/presenter.test.ts`
- Modify: `docs/template/verification-receipts.md`
- Modify: `.gitignore`

**Interfaces:**

- Adds optional `writer: VerificationReceiptWriter` to `createVerifyCommand`
- Persists `.maestro/verification-receipt.json` after a complete observation
- A persistence failure produces a required diagnostic and non-success exit

- [ ] **Step 1: Add failing persistence tests**

Inject a writer spy and assert it receives the exact receipt on pass,
pass-with-advisories, and required failure. Assert persistence failure yields
`AGENT_PACK_VERIFICATION_RECEIPT_PERSIST_FAILED` and never reports verification
as current. Assert absent, current, stale, failed, and malformed receipts render
distinct readiness states.

- [ ] **Step 2: Verify RED**

Run focused `tooling/agent-pack` verify and readiness presenter tests.

- [ ] **Step 3: Persist through the existing bounded writer**

After receipt construction and before returning, call
`writer.persist(context.repo, receipt)`. Inject
`createNodeVerificationReceiptWriter({ maxBytes })` from both factory
compositions. Keep the receipt under the already ignored `.maestro/` directory
with existing `0700`/`0600`, symlink, size, and atomic-rename protections.

- [ ] **Step 4: Improve readiness copy and documentation**

Use `No Maestro verification receipt` for absence, name the rerun command, and
never imply that an unrelated `pnpm verify` invocation emitted the receipt.
Document the owned verification command and stale-receipt semantics.

- [ ] **Step 5: Verify GREEN and commit**

Run Agent Pack verify, receipt-writer, readiness presenter, and CLI verify
tests. Expected: all receipt states and persistence failures are covered.

Commit: `fix: persist trustworthy verification evidence`

---

### Task 7: Make local start collisions recoverable and hosting output explicit

**Files:**

- Modify: `tooling/agent-pack/src/ports.ts`
- Modify: `tooling/agent-pack/src/ports.test.ts`
- Modify: `tooling/agent-pack/src/start.ts`
- Modify: `tooling/agent-pack/src/start.test.ts`
- Modify: `apps/cli/src/factory/start.ts`
- Modify: `apps/cli/src/factory/start.test.ts`
- Modify: `docs/template/start-modes.md`
- Modify: `docs/template/hosting.md`
- Modify: `docs/template/blueprints/saas-application.md`

**Interfaces:**

- Adds: `StartPortOverrides { web?, convex?, convexSite?, readinessPresenter? }`
- Adds CLI flags: `--web-port`, `--convex-port`, `--convex-site-port`,
  `--readiness-port`
- Produces collision diagnostics with an exact non-destructive override rerun

- [ ] **Step 1: Add failing port-override tests**

Assert default ports remain unchanged, valid overrides update URLs/process args,
duplicate/out-of-range ports are rejected, and an occupied default reports an
exact rerun using reviewed free overrides. Assert the probe never calls a kill
API.

- [ ] **Step 2: Verify RED**

Run focused ports, start command, and start CLI tests.

- [ ] **Step 3: Implement validated port overrides**

Accept integers 1024 through 65535, require all required ports to be unique, and
pass the resulting plan through collision inspection, readiness surface, process
plan, and returned data. Include the occupied IDs and ports in JSON diagnostics.
Do not auto-select ports because reproducible URLs matter.

- [ ] **Step 4: Update operational and hosting guidance**

Document exact override examples and explicitly forbid stopping unknown owners.
Clarify that the canonical `saas-application` blueprint emits
`apps/web/dist/client` for the current TanStack/Vite build and that a fork
adding Astro must declare and test its own artifact rather than reuse the Vite
path.

- [ ] **Step 5: Verify GREEN and commit**

Run focused start/port tests and documentation formatting. Expected: defaults,
overrides, collisions, child failures, and clean user-signal shutdown pass.

Commit: `fix: make local start conflicts actionable`

---

### Task 8: Complete the external-failure audit and full verification

**Files:**

- Create: `docs/template/external-user-friction-audit.md`
- Modify only if verification exposes a defect in files changed by Tasks 1-7.

**Interfaces:**

- Produces an evidence table mapping ledger findings to `fixed`, `mitigated`,
  `environmental`, `application-specific`, or `intentionally-unsupported`.

- [ ] **Step 1: Re-run the reproduced commands**

Run with pinned Node 22 and pnpm 10.12.1:

```bash
node scripts/maestro-bootstrap.mjs --json
node maestro-template.mjs --help
node maestro-template.mjs workflow --help
pnpm template:add-workflow -- --help
pnpm template:systems -- --query social sync
node maestro-template.mjs preflight --mode fake --json
```

Expected: bootstrap and help are actionable, multi-word ambiguity is rejected,
and JSON launcher stdout parses as one document.

- [ ] **Step 2: Run focused closure and automation proofs**

Run the launcher integration, scaffold preview/write contract, customer target
integrity/materialization, codegen freshness, receipt/readiness, and port
override suites. Record exact pass counts in the audit.

- [ ] **Step 3: Run complete gates through the host semaphore**

Run:

```bash
host-test-slot --class full fnm exec --using=22.23.2 -- pnpm test
host-test-slot --class full fnm exec --using=22.23.2 -- just verify
```

Expected: exit 0 with zero test, formatting, lint, typecheck, build, generator,
or release-closure failures.

- [ ] **Step 4: Audit the diff and requirements**

Check `git diff --check`, `git status --short`, secret scanning, and each design
goal against current source/test evidence. Do not mark environmental or
unsupported findings fixed.

- [ ] **Step 5: Commit the evidence**

Commit: `docs: record external friction closure evidence`
