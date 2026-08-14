# Security

Security defaults to tenant safety, typed boundaries, redaction, and fake
providers.

## Baseline

- No caller-supplied tenant identity.
- CSRF, CORS, and origin policy are explicit.
- HTTP responses from `packages/convex/confect/http.ts` include CSP, HSTS,
  `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, and
  `Referrer-Policy: no-referrer`.
- The static Cloudflare Pages reference app ships `apps/web/public/_headers`
  with CSP, HSTS, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`,
  `Referrer-Policy: no-referrer`, and a restrictive `Permissions-Policy`.
- A fork that adds SSR or server functions must emit the same policy from its
  Worker responses. Cloudflare `_headers` does not govern responses created by a
  Worker.
- Webhook signatures and replay windows are verified.
- Secrets never enter client bundles.
- Provider setup follows [env-manifest.md](./env-manifest.md); docs and handoff
  packets list secret names, never values.
- Logs redact secrets, tokens, raw provider payloads, and customer content.
- Public source maps are blocked in production unless explicitly approved.
- Storage URLs expire and are scoped.
- API keys are hashed, display-once, scoped, version-aware, and revocable.
- Support access is narrow, justified, and audited.
- Destructive actions require approvals or explicit typed confirmations.
- Prompt-injection boundaries separate source content from instructions.

## API, CLI, And MCP Identity

API, CLI, and MCP callers may pass operation args, but they do not get to assert
workspace authority. Headless entrypoints resolve a `Principal` server-side from
the authenticated request or API key, resolve workspace access on the server,
and then dispatch through generated Confect refs only after the operation is
allowed on that surface.

Public failures crossing API, CLI, and MCP boundaries use declared typed public
errors. Provider errors, config defects, internal causes, secret names, secret
values, stack traces, and raw provider payloads are redacted before they leave
the server. Undeclared provider/config/internal defects are reported through an
opaque public envelope, not through caller-controlled workspace identity or raw
exception text.

## Review

Run `pnpm check:secret-canaries`, `pnpm check:auth-demo-bypass`, and focused
tests for changed auth, provider, storage, webhook, and support/admin behavior.
Review sensitive changes against this document and `coding-standards.md`.

Implemented safety checks:

- `packages/convex/test/http-docs.test.ts` verifies HTTP security headers.
- `apps/web/src/security-headers.test.ts` verifies Cloudflare Pages static
  headers and pins the current TanStack Start static CSP. The static shell still
  needs `script-src 'unsafe-inline'` for TanStack bootstrap scripts; remove that
  allowance only with a nonce/hash-capable rendering path and a matching test
  update.
- `packages/convex/test/data-lifecycle.test.ts` verifies export/delete
  confirmation and current-resource lifecycle planning.
- `packages/notifications/src/index.test.ts` verifies outbound alerts redact
  payload metadata before leaving the seam.
