# Provider Provisioning Inventory

The template must run with fake/local providers by default. Real providers are
typed optional adapters with documented environment variables, smoke tests, and
redaction rules.

| Provider              | Template Role                            | Default Mode                       | Required Setup Evidence                                                                                     |
| --------------------- | ---------------------------------------- | ---------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Convex                | Database, functions, actions, components | Local/dev deployment               | Project/deployment mapping and generated files current.                                                     |
| WorkOS/AuthKit        | Auth, organizations, memberships         | Fake provider until configured     | Client ids, redirect URLs, webhook secret name, role mapping.                                               |
| PostHog               | Analytics and feature telemetry          | Fake/test capture until configured | Project token, host, event contract, privacy settings.                                                      |
| Dodo                  | Billing, checkout, portal, webhooks      | Fake billing until configured      | Product ids, expected amount/currency, launch-canary marker, webhook secret, sandbox smoke, ledger mapping. |
| Admaxxer              | Server-side payment attribution          | Fake attribution until configured  | API key name, visitor-id handoff, purchase event mapping, retry/reconciliation smoke.                       |
| Email (Postmark)      | Transactional and consented broadcasts   | Fake email until configured        | Sender signatures, outbound/broadcast streams, templates, authenticated webhooks, sandbox smoke.            |
| Resend                | Optional email adapter                   | Not enabled by default             | Sender domain and API key name if selected.                                                                 |
| OpenRouter/BYOK       | LLM gateway                              | Fake LLM until configured          | Base URL, model refs, key names, BYOK posture, spend controls.                                              |
| Storage               | Upload/download asset boundary           | Fake storage until configured      | Bucket names, URL expiry, scanner posture, deletion behavior.                                               |
| Cloudflare/Vercel     | Hosting targets                          | Not enabled by default             | App domains, environment mapping, deploy smoke.                                                             |
| Woodpecker            | CI/CD                                    | Local scripts until configured     | Repository slug, scoped secrets, required checks, deploy permissions.                                       |
| Capture/STT providers | Optional voice/capture module            | Disabled by default                | Consent docs, provider key names, retention policy, smoke tests.                                            |

## Provisioning Rules

- Provider docs name required secrets but never include secret values.
- Every live adapter must have fake and test layers.
- Every provider error crossing a public boundary must be typed and redacted.
- Webhook handlers must verify signatures, reject replays, and avoid logging raw
  payloads.
- Provider health checks must be callable in fake mode for reviewer demos.
