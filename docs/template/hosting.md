# Hosting

The reference app currently builds a prerendered TanStack Start SPA and deploys
its static output to Cloudflare Pages. A generated app that adds server
functions, SSR-only authentication, or API proxy routes is no longer a static
app and must choose a server runtime deliberately.

Current Cloudflare Pages URL:

- `https://maestro-template.pages.dev`

See [deployment-lessons.md](./deployment-lessons.md) before provisioning a live
environment. It records the failures found during the first real WorkOS, Convex,
and Cloudflare deployment.

## Static reference deployment

Use this path only while every production route can be prerendered and the app
has no server runtime responsibilities.

```bash
pnpm build
pnpm smoke:web-static
headless-bws-env exec -- pnpm deploy:cloudflare
```

The static artifact is `apps/web/dist/client`. The checked-in
`apps/web/public/_headers` file governs these static responses.

## Recommended server deployment

If the app needs SSR, server functions, WorkOS callbacks, or API proxy routes,
deploy it directly to **Cloudflare Workers with static assets** using the tested
TanStack Start Worker entry. Do not hand-assemble a Pages advanced-mode
`_worker.js`, copy server chunks during deployment, or treat a client output
directory as a complete SSR artifact.

An SSR fork should implement one thin repository command as its operator
interface; this interface is a target and is not provided by the current static
template deploy script:

```bash
pnpm deploy:cloudflare --environment production
```

For an SSR fork, that command should:

1. Select one named environment and validate its Convex, WorkOS, and Cloudflare
   bindings without printing secrets.
2. Deploy and verify Convex first.
3. Remove prior build output and build once with the selected Convex URL baked
   into `VITE_CONVEX_URL`.
4. Build the tracked Worker entry and static assets with a pinned Wrangler
   version and explicit compatibility settings.
5. Verify the active browser entry, server-function routes, dotted API
   operations, and security headers locally.
6. Deploy once, record the Worker version and immutable preview URL, and smoke
   that URL before promoting the production route.
7. Run a fresh-browser WorkOS login, authenticated Convex read, and safe
   mutation against the promoted environment.

Keep this as a short sequence of platform commands. Do not add a second release
ledger, SHA state machine, or automation that guesses provider configuration.

## Required hosted smoke

A successful upload or HTTP `200` is not deployment proof. Hosted smoke must:

- fail on uncaught errors, unexpected `console.error`, failed requests, an empty
  root, or a loading state that never terminates;
- cover public, signed-out, authenticated, and provider-failure states;
- assert the shared shell and route-specific content on representative routes;
- prove one real Convex read and one safe mutation;
- confirm that the active browser entry targets the selected Convex deployment;
- test the immutable deployment before the production route or alias; and
- run the existing hosted smoke commands against the immutable deployed URL.

## Local generated-customer contract acceptance

At the template root, `pnpm acceptance:required` materializes and starts a
disposable local generated customer. In a generated customer, the same command
runs its current checkout. It checks required revision-bound examples locally;
it does not accept a promoted URL or validate real providers. Use it for local
generated-customer contract acceptance, use the hosted smoke commands above for
a deployed URL, and add separately reviewed real-provider validation when a
deployment needs that evidence.

## Provider notes

- **Cloudflare Pages:** preferred only for the static reference output.
- **Cloudflare Workers:** preferred for TanStack Start SSR and server functions.
- **Vercel or another host:** requires its own tested server adapter; do not
  reuse a Cloudflare artifact by changing only the output directory.
- **Convex:** deploy before the frontend and verify the selected production
  deployment with an authenticated read.
- **WorkOS:** configure Convex from claims observed in a real token. Do not
  invent an audience claim or expose server credentials to the browser.
- **Optional providers:** PostHog and similar integrations must not block the
  primary deployment when disabled.
