# Environment Manifest

Status: real documentation, fake-by-default provider posture.

This manifest is the human-readable guide for client-fork environment setup. The
machine-readable source of truth is [`env-manifest.json`](./env-manifest.json),
and CI checks it against `.env.example`, provider descriptors, Convex component
env, deploy config, generator secret lists, and setup UI readiness copy. New
apps should start from `.env.example`, run fake mode first, then replace only
the provider families that the client has approved for test or live use. Every
provider entry includes owner, usage, fake mode, production requirement, and
rotation guidance.

## Rules

- Secrets never enter browser bundles, generated handoff packets, logs, or demo
  fixtures.
- Fake mode must run without live provider credentials.
- Production forks must rotate provider secrets at launch, on team turnover,
  after incidents, and at the provider's required cadence.
- Template runtime settings are loaded through `TemplateRuntimeConfig` and
  `runWithTemplateRuntimeConfig`, not ad hoc environment reads. Legacy shared
  env helpers remain compatibility wrappers for live secret validation.
- Provider SDKs are constructed only inside typed config decoders and Effect
  services.
- `APP_PROVIDER_MODE=fake` is the default until the fork passes provider doctor
  checks.
- Any new environment variable must be added to
  [`env-manifest.json`](./env-manifest.json) in the same change that introduces
  the code, config, generator, or docs reference.

## Provider Matrix

| Provider                  | Env vars                                                                                                                             | Owner                   | Used by                                                                  | Fake mode                                                                                                                                                                                | Production requirement                                                                                                 | Rotation                                                                                                          |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ----------------------- | ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| App identity              | `APP_NAME`, `APP_PUBLIC_BASE_URL`, `APP_ENV`, `APP_PROVIDER_MODE`, `TEMPLATE_RUNTIME_MODE`, `TEMPLATE_PUBLIC_BASE_URL`               | Implementation lead     | web shell, handoff packet, generator output, provider doctors            | Uses `acme-demo`, `fake`, and localhost/example URLs                                                                                                                                     | Must match client app name, deployed domain, and environment                                                           | Review on every client handoff and release promotion                                                              |
| Convex                    | `CONVEX_DEPLOYMENT`, `VITE_CONVEX_URL`, `CONVEX_SITE_URL`                                                                            | Backend owner           | Convex runtime, Confect generated refs, web client                       | Local web mode leaves `VITE_CONVEX_URL` blank so Confect-backed cards render fake-safe states; deployed template environments bake the configured `convexUrl` from `project.config.json` | Required for any backend-backed fork; production must use the production Convex deployment                             | Rotate deployment admin access on team changes; regenerate URL mapping on deployment changes                      |
| WorkOS AuthKit            | `WORKOS_CLIENT_ID`, `WORKOS_ORGANIZATION_ID`, `WORKOS_REDIRECT_URI`, `WORKOS_LOGOUT_URI`, `WORKOS_COOKIE_PASSWORD`, `WORKOS_API_KEY` | Security owner          | TanStack Start auth shell, Convex auth bridge, membership provisioning   | Fake IDs and cookie password keep local demos non-live                                                                                                                                   | Required for production auth; redirect/logout URLs must match deployed domains; API key stays server-only              | Rotate API key and cookie password before production, after access changes, and after any suspected leak          |
| PostHog                   | `POSTHOG_PROJECT_TOKEN`, `POSTHOG_HOST`                                                                                              | Product analytics owner | web analytics provider, backend Confect failure events, readiness checks | Fake/test posture uses `POSTHOG_PROJECT_TOKEN=phc_test_placeholder` and optional `POSTHOG_HOST=http://localhost`; local checks never require live credentials                            | Required only when analytics is enabled for the client; client data-map must approve captured events                   | Rotate project token when project ownership changes; review capture schema every release                          |
| Dodo payments             | `DODO_API_KEY`, `DODO_WEBHOOK_SECRET`, `DODO_ENVIRONMENT`                                                                            | Billing owner           | billing gateway, webhook verifier, usage ledger reconciliation           | Test environment and fake keys create no real charges                                                                                                                                    | Required only for paid forks; webhook secret and idempotency checks must be live before billing launch                 | Rotate API and webhook secrets before launch, after billing admin changes, and after webhook incidents            |
| MailerSend email          | `MAILERSEND_API_KEY`, `MAILERSEND_FROM_EMAIL`, `MAILERSEND_FROM_NAME`, `EMAIL_DISABLED`                                              | Notifications owner     | email service, invite flow, lifecycle notices, handoff notices           | `EMAIL_DISABLED=true` records send intents without delivery                                                                                                                              | Required for production email; sender domain must be verified and approved by client                                   | Rotate API key on team turnover; review sending domain and suppression posture quarterly                          |
| OpenRouter-compatible LLM | `OPENROUTER_API_KEY`, `OPENROUTER_BASE_URL`, `LLM_PROVIDER_MODE`, `LLM_DISABLED`, `LLM_DAILY_SPEND_LIMIT_CENTS`, `LLM_DEFAULT_MODEL` | AI platform owner       | LLM gateway, agent turns, capability model calls, eval fixtures          | Fake model returns deterministic demo completions and honors spend caps                                                                                                                  | Required only when live model calls are enabled; must set spend cap, model allowlist, redaction, and telemetry posture | Rotate API key before launch and after provider access changes; review model allowlist and spend cap each release |
| Object storage            | `STORAGE_PROVIDER`, `STORAGE_BUCKET`, `STORAGE_PUBLIC_BASE_URL`, `STORAGE_ACCESS_KEY_ID`, `STORAGE_SECRET_ACCESS_KEY`                | Data platform owner     | source uploads, evidence snapshots, export packages, signed URL seam     | Fake storage stores local/test descriptors and synthetic URLs                                                                                                                            | Required for uploaded customer files or export packages; bucket policy must deny public writes and use expiring URLs   | Rotate access keys on team turnover; review bucket policy and lifecycle rules quarterly                           |
| Search                    | `SEARCH_PROVIDER`, `SEARCH_API_KEY`, `SEARCH_INDEX_PREFIX`                                                                           | Knowledge owner         | optional keyword/vector search seam, context-pack search extension       | Fake search uses deterministic in-memory/index fixture behavior                                                                                                                          | Optional; required only when a fork enables search or RAG-backed retrieval                                             | Rotate key before live enablement; rebuild indexes after schema or redaction changes                              |
| Cloudflare                | `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_PAGES_PROJECT`, `CLOUDFLARE_PAGES_BRANCH`, `TEMPLATE_HOSTED_URL`        | Deploy owner            | hosted smoke, Pages deploy, future Workers decision gate                 | Fake values are enough for local docs and generator output; hosted smoke needs a real URL                                                                                                | Required for hosted environments; token must be scoped to the project and environment                                  | Rotate token on deploy-admin changes; review Pages/Workers mapping before promotion                               |
| Buildkite                 | `BUILDKITE_ORGANIZATION_SLUG`, `BUILDKITE_PIPELINE_SLUG`, `BUILDKITE_API_TOKEN`, `BUILDKITE_AGENT_TOKEN`                             | CI owner                | CI status checks, AI gates, release promotion, agent workers             | Fake tokens are placeholders only; local quickstart does not call Buildkite                                                                                                              | Required for CI-backed production promotion and AI gate workflows                                                      | Rotate API and agent tokens after CI admin changes, agent image changes, and any log exposure                     |

The template's own CI keeps one Convex deployment behind both Pages
environments: the demo backend is read-only seeded data, so staging and
production `convexUrl` both point at the production deployment and CI deploys
functions with the cluster secret `TEMPLATE_CONVEX_DEPLOY_KEY` (namespaced —
plain `CONVEX_DEPLOY_KEY` in the shared Buildkite cluster belongs to another
pipeline). Forks with real tenant data must mint separate staging/production
deployments and keys before the staging→production promotion gate means anything
for the backend.

`pnpm template:doctor` reads `docs/template/env-manifest.json` for provider
requirements in generated instance reports. Live-mode warnings list the
manifest-backed env names for each provider family without printing values.

`pnpm deploy:doctor` reads `project.config.json` and
`docs/template/env-manifest.json` together. `requiredEnvGroups` in
`project.config.json` expand to concrete manifest entries, so deploy reports
name the missing environment variables without printing values. Staging checks
deploy-scoped manifest entries; production checks deploy entries plus live
provider entries for the configured groups. CI runtime markers such as
`BUILDKITE_COMMIT` are documented in the manifest but are not required by local
deploy doctor runs.

WorkOS forks also derive Convex trusted JWT settings from the AuthKit issuer,
JWKS URL, and client/application ID. The template ships a fake-safe
`packages/convex/convex/auth.config.ts`; production forks must replace the
issuer/JWKS/client values through the deployment secret/config path before
claiming live auth readiness.

## Template Runtime Config

`TEMPLATE_RUNTIME_MODE` controls the Effect runtime mode boundary. Valid values
are `fake`, `test`, and `live`; the default is `fake`.

`TEMPLATE_PUBLIC_BASE_URL` is the public URL used by template runtime services.
The default is `http://localhost:5173`.

Runtime services should depend on `TemplateRuntimeConfig` and tests should use
`runWithTemplateRuntimeConfig` with an Effect `ConfigProvider` override when
they need deterministic values.

## Quickstart Modes

### 10-Minute Fake Mode

Use `.env.example` as-is or copy it to `.env.local`. Keep all provider modes
fake or disabled. Leave `VITE_CONVEX_URL` blank unless you are intentionally
connecting the web app to a live Convex dev deployment. This path should support
install, quickstart generation, demo seed, local app review, fake workflow run,
and handoff packet preview.

### 30-Minute Client Discovery Mode

Keep fake keys. Replace only non-secret names: `APP_NAME`,
`APP_PUBLIC_BASE_URL`, `WORKOS_ORGANIZATION_ID` if known, `SEARCH_INDEX_PREFIX`,
and `STORAGE_BUCKET`. Record real provider decisions in the implementation brief
before requesting secrets.

### One-Day Prototype Mode

Use test provider credentials only for provider families required by the first
vertical. Leave all other providers fake. Run `template:doctor -- --mode fake`
before adding live credentials and `template:doctor -- --mode live` before any
external demo that claims live-provider readiness.

## Secret Handling

- Store real secrets in the team's approved secret manager or deployment
  provider, not in `.env.example`, docs, generated packets, fixtures, or git.
- Handoff packets may list required secret names but never values.
- Logs and Trust Receipts may include provider status, request IDs, and redacted
  metadata, but not raw provider payloads or customer secrets.
- Browser-visible variables must be explicitly public and safe to expose.

## Adding A Provider

When adding a new provider, update `env-manifest.json`, this file,
`.env.example`, the implementation brief template, the handoff packet, and the
data map. The template and deploy doctors consume the manifest directly. The new
provider must define fake, test, and live-ready behavior before client forks
rely on it.
