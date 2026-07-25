# Maestro Agent Pack Privacy

Maestro V1 has no product telemetry. The factory, CLI, and agent pack do not
send usage, diagnostics, receipts, or support bundles to Maestro. Normal create,
start, add, plan, scaffold preview, check, and fake/local operations process
committed files and local process facts on your machine.

This promise covers Maestro, not every tool you choose to use with it. Claude
Code, Codex, or another model host may receive prompts, instructions, and
context according to that host's settings and terms. A Convex MCP inspect
profile or personal dev deployment may receive the data you ask it to inspect or
run. A configured model, storage, notification, or other provider may receive
the data needed for the specific operation you request. A `dev` label means
non-production authority; it does not mean offline or data-private.

## Local evidence and retention

Maestro may write bounded verification receipts and explicitly exported support
bundles under the repository-local `.maestro/` directory. These files remain
local until you move or delete them. Maestro does not upload them. Their
retention is controlled by the repository owner; delete them with ordinary local
file controls when they are no longer needed.

A support bundle is preview-first and allowlisted. V1 can contain only
product-owned version numbers and categorical host/provider posture. It does not
contain receipt facts, diagnostic text or codes, command metadata, source text,
prompts, file contents, raw paths, environment values, secret values,
authentication or session state, provider payloads, identities, customer or
production data, unredacted logs, or arbitrary files. Exporting a bundle is a
local write and never an upload.

## Secrets and logs

Keep tokens, API keys, deploy keys, cookies, and credentials in approved
server-side or host-local secret stores. Maestro inspects environment variable
names only where a readiness check requires them; values must not cross CLI,
receipt, diagnostic, MCP, or support boundaries. Do not paste unredacted logs or
provider payloads into support material.

## Explicit external opt-in

Outbound access is allowed only after you select a documented, purpose-specific
external operation. The current opt-in boundaries are:

- a Convex `inspect` or separately confirmed `dev-power` MCP profile for a
  personal dev deployment;
- a configured provider operation requested by the user; and
- an official framework-context freshness refresh requested by a maintainer.

Before one of these operations, review which host or provider receives data and
why. Fake mode has no MCP. Production Convex MCP is unsupported. Installing the
pack does not authenticate, enable telemetry, start a daemon, launch a hosted
service, or add a supervisory AI.

Any future Maestro telemetry requires a reviewed ADR, a public event schema,
retention and deletion rules, an obvious disable path, explicit opt-in, and a
preview showing the exact event before it is sent.
