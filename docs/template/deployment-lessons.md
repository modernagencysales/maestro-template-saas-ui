# Deployment lessons from B2B Creator OS

These failures were observed during the first real deployment of a generated
TanStack Start app with Cloudflare, WorkOS, and Convex. Each row names the
smallest guardrail worth carrying into future projects.

| Failure                                                                                                   | Cause                                                                                                                                 | Future guardrail                                                                                                                         |
| --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Incognito loads showed a white screen and `TypeError: ... is not a function` in generated vendor chunks.  | Size-based Rolldown splitting divided package internals and emitted cyclic client chunks.                                             | Split only at package boundaries, reject cycles in the emitted client graph, and test a cache-disabled hosted load.                      |
| Applying the client chunk policy globally broke SSR with another generated `... is not a function` error. | Client and server bundles have different dependency boundaries.                                                                       | Scope client chunking to the client environment and rerun SSR prerender after bundle-policy changes.                                     |
| Browser smoke passed while the document was empty.                                                        | It watched `pageerror` but ignored `console.error`, failed requests, visible content, and terminal loading state.                     | Require visible route content and fail on runtime errors, unexpected console errors, failed requests, an empty root, or endless loading. |
| The browser warned that Convex functions were imported in the browser.                                    | Server registrations crossed the client boundary.                                                                                     | Keep runtime Convex registrations server-only and add a built-browser import check.                                                      |
| Authentication completed but the app stayed on `Connecting to your workspace`.                            | The Vite build omitted the production `VITE_CONVEX_URL` and baked a template fallback; runtime `CONVEX_URL` could not repair it.      | Resolve the named environment, clean-build with its exact URL, and inspect the active entry referenced by generated HTML.                |
| A bundle search appeared to find the wrong Convex deployment even after repair.                           | It matched a URL in Convex's example error text rather than the configured runtime value.                                             | Inspect the active entry's configuration, not every URL string in every dependency chunk.                                                |
| Convex rejected the WorkOS token because its audience was missing.                                        | The integration guessed that AuthKit supplied `aud` and configured `applicationID`; the real token was issuer-bound with no audience. | Inspect one real token's public claims and configure only claims it actually carries.                                                    |
| Auth failures were reported only as generic workspace errors.                                             | The first production integration had no safe claim diagnostics or visible provider-failure state.                                     | During initial setup, expose redacted issuer/audience diagnostics and always render a visible terminal error state.                      |
| Convex deployment was blocked by a missing PostHog token.                                                 | An optional observability provider was treated as mandatory.                                                                          | Validate optional providers only when enabled; never let them block auth or the primary journey.                                         |
| Deployment required copying SSR assets, `server.js`, and writing `_worker.js` by hand.                    | No canonical server artifact target existed.                                                                                          | Use a tracked Cloudflare Worker entry and one reproducible build/deploy command; manual artifact surgery is recovery-only.               |
| Wrangler warned about unsupported `node:` modules.                                                        | The server artifact depended on Node compatibility while runtime settings were implicit.                                              | Check in the compatibility date/flags, pin Wrangler, and fail on new compatibility warnings.                                             |
| Dotted API operations returned empty `405` responses and callers failed parsing JSON.                     | A hand-written Worker treated any dotted final path segment as a static asset before checking `/api/` or `/_serverFn/`.               | Route framework and API paths first, then static assets; test a dotted operation and require a non-empty JSON response.                  |
| Creators, Recruitment, and Analytics appeared to leave the app frame.                                     | The routes omitted the shared workspace shell.                                                                                        | Hosted route smoke must assert both the shared shell and route-specific content.                                                         |
| `_headers` appeared on assets but not SSR documents.                                                      | Cloudflare static headers do not govern Worker-generated responses.                                                                   | Emit and test the same security policy in Worker responses; include Convex WebSocket origins when CSP applies.                           |
| A fresh upload briefly served old behavior from the production alias.                                     | The immutable deployment completed before the alias converged at the edge.                                                            | Smoke the immutable preview first, then poll until the promoted route serves its version or active entry.                                |
| Hosting docs advertised commands that did not exist.                                                      | Intended automation was documented as implemented behavior.                                                                           | Verify every documented command against `package.json`, and label planned commands explicitly.                                           |
| Cucumber passed against partial adapters while the composed live app remained broken.                     | Scenarios did not prove the real CLI/UI journeys against deployed providers.                                                          | Rerun required journeys after composition against real WorkOS, Convex, and hosted runtime.                                               |

## Decision for the next project

Use Cloudflare Pages for a genuinely static generated app. Once the app has
server functions or SSR-only auth, use Cloudflare Workers with static assets and
the native TanStack Start fetch handler. This removes the custom Pages
advanced-mode assembly that caused several failures while keeping one Cloudflare
deployment surface.

The optimal sequence is:

```text
named environment -> Convex deploy/read -> clean Worker build
                  -> local artifact checks -> immutable preview smoke
                  -> production promotion -> authenticated journeys
```

The repository should expose one thin command for that sequence. Agents retain
judgment over migrations, provider ownership, and rollback; automation validates
known invariants and stops rather than repairing or guessing.
