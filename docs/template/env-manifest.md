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

| Provider                  | Env vars                                                                                                                                                                                                                                               | Owner                      | Used by                                                                                   | Fake mode                                                                                                                                                     | Production requirement                                                                                                                   | Rotation                                                                                                 |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| App identity              | `APP_NAME`, `APP_PUBLIC_BASE_URL`, `APP_ENV`, `APP_PROVIDER_MODE`, `VITE_MAESTRO_AUTH_MODE`, `TEMPLATE_RUNTIME_MODE`, `TEMPLATE_PUBLIC_BASE_URL`                                                                                                       | Implementation lead        | web shell, handoff packet, generator output, provider doctors                             | Uses `acme-demo`, `fake`, `fixture`, and localhost/example URLs                                                                                               | Must match client app name, deployed domain, and environment; fixture auth is forbidden in production                                    | Review on every client handoff and release promotion                                                     |
| Convex                    | `CONVEX_DEPLOYMENT`, `VITE_CONVEX_URL`, `CONVEX_SITE_URL`, `TEMPLATE_STAGING_CONVEX_DEPLOYMENT`, `TEMPLATE_STAGING_CONVEX_URL`, `TEMPLATE_PRODUCTION_CONVEX_DEPLOYMENT`, `TEMPLATE_PRODUCTION_CONVEX_URL`                                              | Backend owner              | Convex runtime, Confect generated refs, web client, deploy isolation                      | Local web mode leaves `VITE_CONVEX_URL` blank so Confect-backed cards render fake-safe states                                                                 | Staging and production bindings are mandatory, externally supplied, and must identify different Convex deployments                       | Rotate deployment admin access on team changes; regenerate URL mapping on deployment changes             |
| WorkOS AuthKit            | `WORKOS_CLIENT_ID`, `WORKOS_ORGANIZATION_ID`, `WORKOS_REDIRECT_URI`, `WORKOS_LOGOUT_URI`, `WORKOS_COOKIE_PASSWORD`, `WORKOS_API_KEY`                                                                                                                   | Security owner             | TanStack Start auth shell, Convex auth bridge, membership provisioning                    | Fake IDs and cookie password keep local demos non-live                                                                                                        | Required for production auth; redirect/logout URLs must match deployed domains; API key stays server-only                                | Rotate API key and cookie password before production, after access changes, and after any suspected leak |
| PostHog                   | `POSTHOG_PROJECT_TOKEN`, `POSTHOG_HOST`                                                                                                                                                                                                                | Product analytics owner    | web analytics provider, backend Confect failure events, readiness checks                  | Fake/test posture uses `POSTHOG_PROJECT_TOKEN=phc_test_placeholder` and optional `POSTHOG_HOST=http://localhost`; local checks never require live credentials | Required only when analytics is enabled for the client; client data-map must approve captured events                                     | Rotate project token when project ownership changes; review capture schema every release                 |
| Dodo payments             | `DODO_API_KEY`, `DODO_WEBHOOK_SECRET`, `DODO_ENVIRONMENT`, `DODO_BUILD_PACK_PRODUCT_ID`, `DODO_BUILD_PACK_EXPECTED_AMOUNT_CENTS`, `DODO_BUILD_PACK_EXPECTED_CURRENCY`, `DODO_BUILD_PACK_LAUNCH_CANARY`                                                 | Billing owner              | billing gateway, webhook verifier, product/amount/currency binding, canary reconciliation | Test environment and fake keys create no real charges                                                                                                         | Required only for paid forks; webhook secret, product/amount/currency binding, and idempotency checks must be live before billing launch | Rotate API and webhook secrets before launch, after billing admin changes, and after webhook incidents   |
| Admaxxer                  | `ADMAXXER_API_KEY`                                                                                                                                                                                                                                     | Growth analytics owner     | server-side purchase attribution                                                          | Fake key never sends provider traffic                                                                                                                         | Required for live paid launch; keep server-only                                                                                          | Rotate after provider access changes or attribution incidents                                            |
| Provider-neutral email    | `POSTMARK_SERVER_TOKEN`, `EMAIL_TRANSACTIONAL_FROM`, `EMAIL_MARKETING_FROM`, `EMAIL_REPLY_TO`, `EMAIL_UNSUBSCRIBE_SECRET`, `POSTMARK_WEBHOOK_USERNAME`, `POSTMARK_WEBHOOK_PASSWORD`, `EMAIL_DISABLED`                                                  | Notifications owner        | transactional templates, consented broadcasts, unsubscribe, delivery events               | `EMAIL_DISABLED=true` records send intents without delivery                                                                                                   | Postmark is the live adapter; verify sender signatures, `outbound`/`broadcast` streams, templates, and authenticated webhooks            | Rotate server/webhook credentials on turnover; review suppression posture quarterly                      |
| OpenRouter-compatible LLM | `OPENROUTER_API_KEY`, `OPENROUTER_BASE_URL`, `LLM_PROVIDER_MODE`, `LLM_DISABLED`, `LLM_DAILY_SPEND_LIMIT_CENTS`, `LLM_DEFAULT_MODEL`, `LLM_FREE_MODEL`, `LLM_PREMIUM_MODEL`, `LLM_FREE_DAILY_SPEND_LIMIT_CENTS`, `LLM_PREMIUM_DAILY_SPEND_LIMIT_CENTS` | AI platform owner          | bounded free evaluations, paid Build Pack stages, agent turns, eval fixtures              | Fake models return deterministic completions; free and premium calls use separate models and spend ceilings                                                   | Required only when live model calls are enabled; free calls remain cheap and bounded while premium calls require entitlement             | Rotate API key after provider access changes; review both model allowlists and spend caps each release   |
| Object storage            | `STORAGE_PROVIDER`, `STORAGE_BUCKET`, `STORAGE_PUBLIC_BASE_URL`, `STORAGE_ACCESS_KEY_ID`, `STORAGE_SECRET_ACCESS_KEY`                                                                                                                                  | Data platform owner        | source uploads, evidence snapshots, export packages, signed URL seam                      | Fake storage stores local/test descriptors and synthetic URLs                                                                                                 | Required for uploaded customer files or export packages; bucket policy must deny public writes and use expiring URLs                     | Rotate access keys on team turnover; review bucket policy and lifecycle rules quarterly                  |
| Search                    | `SEARCH_PROVIDER`, `SEARCH_API_KEY`, `SEARCH_INDEX_PREFIX`                                                                                                                                                                                             | Knowledge owner            | optional keyword/vector search seam, context-pack search extension                        | Fake search uses deterministic in-memory/index fixture behavior                                                                                               | Optional; required only when a fork enables search or RAG-backed retrieval                                                               | Rotate key before live enablement; rebuild indexes after schema or redaction changes                     |
| Cloudflare                | `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`, environment-specific `TEMPLATE_*_CLOUDFLARE_*`, `CLOUDFLARE_PAGES_PROJECT`, `CLOUDFLARE_PAGES_BRANCH`, environment-specific `TEMPLATE_*_HOSTED_URL`                                                   | Deploy owner               | hosted smoke, Pages deploy, rollback receipts                                             | Fake values are enough for local docs; guarded deploy requires a real environment-specific binding                                                            | Each token must be scoped to its Pages project; hosted canary and prior-version coordinates are required                                 | Rotate token on deploy-admin changes; advance reviewed rollback coordinates after promotion              |
| Woodpecker                | `WOODPECKER_SERVER`, `WOODPECKER_REPOSITORY`, `WOODPECKER_API_TOKEN`, `WOODPECKER_TOKEN`                                                                                                                                                               | CI owner                   | CI status checks, guarded staging, and exact-SHA production promotion                     | Fake tokens are placeholders only; local quickstart does not call Woodpecker                                                                                  | Required for CI-backed production promotion                                                                                              | Rotate API tokens after CI admin changes and any log exposure                                            |
| Deployment authority      | `PROMOTION_AUTHORITY_ENDPOINT`, `TRUSTED_DEPLOY_ROOT_SHA256`, `TRUSTED_CI_SELF_PROTECTION_COMMIT`, `TRUSTED_ROLLBACK_SEED_COMMIT`, `ROLLBACK_RECEIPT_BUILD_ID`                                                                                         | Deployment authority owner | secretless preflight, trusted CI bootstrap, guarded deploy and rollback                   | No fake authority is accepted for deploys; local checks may omit these values and report unavailable                                                          | Values are externally pinned. Trusted commits are exact immutable SHAs; pre-seed rollback is forbidden                                   | Move or advance a binding only through an external reviewed trust/freeze ceremony                        |
| Authority runtime         | `PROMOTION_AUTHORITY_MODE`, `PROMOTION_AUTHORITY_PRIVATE_KEY_PKCS8_BASE64URL`                                                                                                                                                                          | Deployment authority owner | independent Convex authority signing runtime                                              | No fake signing runtime exists; `PROMOTION_AUTHORITY_MODE` must be exactly `authority`                                                                        | Provision only on the independent authority deployment; the private key must never enter Woodpecker or an application environment        | Rotate the private key through the authority ceremony; changing mode requires a control-plane migration  |

Template CI requires separate staging and production Convex deployment names,
origins, and deploy keys. `project.config.json` stores only the binding names;
`scripts/_project-config.mjs assert-isolated-convex` resolves them from the
externally managed Woodpecker environment and rejects missing, malformed, or
same-deployment `.convex.cloud`/`.convex.site` pairs before authority or
provider actions. Each deployment coordinate and URL must also match the
environment's canonical identity in `project.config.json`; after credentials
arrive, `assert-convex-deploy-key` compares only the deploy key's public prefix
to that coordinate and never logs or serializes the key. Hosted builds always
replace an inherited generic `VITE_CONVEX_URL` with the selected environment
binding. Environment-specific Cloudflare tokens, hosted URLs, and prior provider
coordinates follow the same fail-closed posture. No showcase exception permits a
shared writable backend.

`pnpm template:doctor` reads `docs/template/env-manifest.json` for provider
requirements in generated instance reports. Live-mode warnings list the
manifest-backed env names for each provider family without printing values.

`pnpm deploy:doctor` reads `project.config.json` and
`docs/template/env-manifest.json` together. `requiredEnvGroups` in
`project.config.json` expand to concrete manifest entries, so deploy reports
name the missing environment variables without printing values. Staging checks
deploy-scoped manifest entries; production checks deploy entries plus live
provider entries for the configured groups. CI runtime markers such as
`CI_COMMIT_SHA` is documented in the manifest but is not required by local
deploy doctor runs.

Deploy doctor accepts `PROMOTION_AUTHORITY_ENDPOINT` only as an HTTPS base
origin: no credentials, path, query, or fragment are allowed, and its origin
must differ from the selected environment's target `convexUrl`.
`TRUSTED_DEPLOY_ROOT_SHA256` pins the repository verifier, deploy policy, and
public verification key. The promotion-authority signing key remains solely in
the already-live authority control plane. Its environment-manifest entry
documents the authority-runtime-only typed server secret; it is never a
Woodpecker secret, repository value, or deploy-script bootstrap input. The typed
declaration in `packages/convex/convex/convex.config.ts`, this manifest, and the
operations runbook must agree that `PROMOTION_AUTHORITY_MODE` accepts exactly
`authority` and `PROMOTION_AUTHORITY_PRIVATE_KEY_PKCS8_BASE64URL` is an
authority-runtime-only server secret. Neither name authorizes the application
pipeline to provision, query, log, or receive the private key; the deploy
authority gate forbids it on every Woodpecker surface.
`TRUSTED_CI_SELF_PROTECTION_COMMIT` pins the setup, deploy-authority verifier,
and secretless self-protection script that execute instead of bootstrap scripts
from the mutable checkout. The first reviewed successor containing the complete
rollback closure is provisioned as `TRUSTED_ROLLBACK_SEED_COMMIT`; commits
outside that ancestry are ineligible for automated rollback.
`ROLLBACK_RECEIPT_BUILD_ID` binds rollback to the exact public source-build
coordinate recorded in the reviewed receipt.

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

Fake and review builds use `VITE_MAESTRO_AUTH_MODE=fixture`. That mode never
constructs WorkOS middleware and uses local shell/data adapters. A build with
`APP_ENV=production` rejects fixture auth before compilation; production uses
`VITE_MAESTRO_AUTH_MODE=workos` and requires the reviewed WorkOS configuration.

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
