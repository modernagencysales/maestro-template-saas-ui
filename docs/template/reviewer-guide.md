# Reviewer Guide

This guide is the 30-minute technical diligence path.

For the executive technical packet, start with
[investor-reviewer-packet.md](./investor-reviewer-packet.md).

## 1. Run The Repo Locally

```bash
pnpm install
pnpm review:readiness
pnpm review:completion
pnpm check:format
pnpm lint
pnpm typecheck
host-test-slot --class full pnpm test
pnpm build
```

`review:readiness` and `review:completion` are presence/evidence audits. They
check required files and listed evidence paths; run the verification commands
below for behavioral proof. `host-test-slot` is optional internal host tooling
that serializes expensive tests; on a fresh external clone, use the command
after it directly, such as `pnpm test` or `pnpm verify`.

Structured Maestro verification output follows the versioned contract and
examples in [verification-receipts.md](./verification-receipts.md); raw gate
commands remain authoritative.

Start the reference app:

```bash
pnpm --dir apps/web dev -- --port 5174
```

Open `http://127.0.0.1:5174/`. The first screen is the generic AI operations
workspace: Brain, workflows, capabilities, agents, integrations, headless
surfaces, and safety posture.

The hosted static reference app is available at:

```text
https://maestro-template.pages.dev
```

If port `5174` is busy, use any free port:

```bash
pnpm --dir apps/web dev -- --port 5184
```

## 2. Inspect The Product Surfaces

Open the reference app and inspect:

- reusable app shell and navigation from the manifest compositions and installed
  Saas UI Pro paths;
- React Flow workflow primitive from `packages/workflow-ui`;
- Brain/source/context/trust receipt model;
- capabilities, agents, and workflow composition model;
- API/CLI/MCP and provider adapter posture;
- safety model and generated contract checklist.

The app intentionally uses reviewer-safe synthetic data and fake/local provider
posture. The `templateRegistry`/template-core registry in
`packages/template-core/src/index.ts` is sample reviewer data and compatibility
metadata for the web walkthrough and deterministic workflow adapter; the web app
imports it through `apps/web/src/sample/templateData.ts`. Tests for section
coverage and workflow graph integrity live in
`apps/web/src/sample/templateData.test.ts`.

The public headless surface source of truth is the generated Confect contract
manifest and exposure metadata in
`packages/template-core/src/generated/confectManifest.ts`, paired with explicit
generated ref mappings such as `generatedCliOperationRefs` and
`generatedMcpOperationRefs` in `tooling/workflow/src/index.ts` and the HTTP
operation refs in `packages/convex/confect/http.ts`. The headless projection in
`tooling/workflow/src/index.ts` turns that generated manifest metadata into
stable operation metadata for API, CLI, MCP, OpenAPI, and Scalar docs.

Inspect the generated headless operations through the CLI:

```bash
pnpm exec tsx apps/cli/src/index.ts describe
pnpm exec tsx apps/cli/src/index.ts operations list
pnpm exec tsx apps/cli/src/index.ts operations get cli:brain.pages.createMarkdown
pnpm exec tsx apps/cli/src/index.ts workflow run
pnpm exec tsx apps/cli/src/index.ts api catalog
pnpm exec tsx apps/cli/src/index.ts api openapi
pnpm exec tsx apps/cli/src/index.ts mcp tools
pnpm exec tsx apps/cli/src/index.ts mcp call template.workflow.run
pnpm exec tsx apps/cli/src/index.ts integrations report fake
pnpm template:quickstart -- --blueprint source-grounded-gtm-brain --name "Reviewer Brain" --write
pnpm template:doctor -- --mode fake
pnpm template:seed-demo -- --blueprint source-grounded-gtm-brain --write
pnpm template:handoff -- --mode fake --write
```

`api openapi` prints an OpenAPI 3.1 document generated from the Confect manifest
metadata used by the CLI and MCP surfaces. The same document is served by the
backend HTTP docs route in `packages/convex/confect/http.ts` at
`/api/openapi.json`, with the Scalar shell at `/api/docs`. The same route also
mounts reviewer-safe executable `POST /api/<operation>` handlers backed by the
generated HTTP ref mapping; `packages/convex/test/http-docs.test.ts` proves
`POST /api/brain.pages.createMarkdown` accepts the generated route contract.

`mcp call template.workflow.run` invokes the deterministic reviewer-safe
workflow compatibility adapter and returns the workflow receipt as an MCP-style
tool result.

`template:quickstart` writes the client-instance manifest, implementation brief,
deterministic fake seed, and handoff packet. Use `template:init` when you only
need the low-level manifest file.

`review:completion` maps the original template objective to concrete evidence
and verification commands so reviewers can see what is proved, what is hosted,
and what remains client-specific.

## 3. Run One Workflow

The current app shows the workflow authoring primitive and a deterministic
reviewer-safe run receipt. Inspect the same receipt through:

- web workflow builder;
- CLI command `workflow run`;
- future MCP tool.

Inspect the run receipt, audit event, and Trust Receipt.

## 4. Inspect Confect

Open one Confect spec, its impl, and generated refs. Confirm args, returns, and
expected errors are Effect schemas and that callers use generated refs. Then
inspect `packages/convex/test/confect-contracts.test.ts`, which checks generated
ref metadata, capability schema validation, public-safe typed errors, and plain
Convex registration shape without requiring a live Convex deployment.

The access spine now includes real Confect/Effect provisioning:
`packages/convex/confect/access/provisioning.spec.ts`,
`packages/convex/confect/access/provisioning.impl.ts`, and
`packages/convex/test/access-provisioning.test.ts` prove the first-sign-in
workspace path, verified provider identity handling, idempotency, self-healing
owner memberships, suspended-user denial, and duplicate-live-row conflict
handling.

Membership and invitation lifecycle policy is implemented as a pure typed kernel
in `packages/convex/confect/access/lifecycle.ts`, with behavior coverage in
`packages/convex/test/access-lifecycle.test.ts`. It covers escalation-safe role
changes, removal, ownership transfer, last-owner protection, invitation
creation, accept, decline, cancel, opaque invite denial, expiry handling, and
audit-ready domain events. The Confect database groups in
`packages/convex/confect/access/members.*` and
`packages/convex/confect/access/invitations.*` expose generated refs for member
role changes, removal, ownership transfer, invitation create, accept, decline,
and cancel through `packages/convex/test/access-confect-groups.test.ts`.

The web package now has a reusable workspace provider in
`apps/web/src/providers/workspace.tsx`, covered by
`apps/web/src/providers/workspace.test.tsx`. It models loading, empty-account
provisioning, active workspace persistence, workspace switching, and
provisioning failure without requiring live Convex or WorkOS secrets. The
reference app does not render a new status widget yet, because the current
diligence surface is intentionally a calm document until live app routes are
wired.

## 5. Inspect Operations

Read:

- [operations-runbook.md](./operations-runbook.md)
- [data-lifecycle.md](./data-lifecycle.md)
- [security.md](./security.md)

Confirm deploy, rollback, export/delete, and support access are documented.

## 6. Run Fast Verification

```bash
pnpm check:format && pnpm lint && pnpm typecheck && host-test-slot --class full pnpm test && pnpm build
```

For the full deterministic gate chain, use:

```bash
host-test-slot --class full pnpm verify
```

If `host-test-slot` is unavailable, run `pnpm verify` directly.

## 7. Smoke The Static Reference App

```bash
pnpm build
pnpm smoke:web-static
pnpm smoke:starter-route-parity
```

The golden smokes verify the pinned reference and freshly generated target
through the shared upstream shell. Browser and visual runs cover desktop/mobile
interactions and paired captures; the a11y run adds axe WCAG 2 A/AA scans.
