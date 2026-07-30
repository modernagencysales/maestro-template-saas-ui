# Hosting

The current reference app is a static Vite build. It can be hosted on Vercel,
Cloudflare Pages, Netlify, or any static asset host.

Current Cloudflare Pages URL:

- `https://maestro-template.pages.dev`

TanStack Start is the committed runtime direction for the template, but the Vite
static deployment remains the production-safe reference path until the Start
build has equivalent local static smoke, hosted HTTP smoke, hosted browser
smoke, hosted visual smoke, and rollback documentation. The first Start deploy
target should be static Cloudflare Pages output if equivalent. Cloudflare
Workers SSR is deferred until env mapping and rollback are explicit.

## Local Static Smoke

```bash
pnpm build
pnpm smoke:web-static
```

The smoke verifies `apps/web/dist/client/index.html`, the React root, linked
built assets, and asset count. It is the minimum reviewer-safe proof before
pointing a hosting provider at the repo.

## Recommended Hosting Defaults

- Build command: `pnpm build`
- Output directory: `apps/web/dist/client`
- Node package manager: `pnpm`
- Environment: fake/local providers by default
- Production promotion: only from a commit that passed `pnpm verify` and
  `pnpm smoke:web-static`
- Runtime migration: see [frontend-architecture.md](./frontend-architecture.md)
  and
  [../design-intake/2026-07-01-template-frontend-stack-source.md](../design-intake/2026-07-01-template-frontend-stack-source.md)
  before changing the deploy target.

`apps/web/dist/client` is the canonical static artifact for the current
TanStack/Vite build. A fork that adds Astro must declare and test its own output
artifact; it must not reuse this Vite path by assumption.

## Cloudflare Pages

The reference app ships Cloudflare Pages headers in `apps/web/public/_headers`.
Vite copies this file into the static output, so hosted Pages responses receive
CSP, HSTS, frame, nosniff, referrer, and permissions-policy defaults without a
Worker. Keep the CSP synchronized with TanStack Start output; the current static
shell requires `script-src 'unsafe-inline'` for framework bootstrap scripts.

Create the project once:

```bash
pnpm dlx wrangler@latest pages project create maestro-template --production-branch main
```

Deploy:

```bash
pnpm deploy:cloudflare
```

Smoke the hosted app:

```bash
pnpm smoke:hosted
pnpm smoke:hosted:browser
pnpm smoke:hosted:a11y
pnpm smoke:hosted:visual
```

## TanStack Start Migration Gate

Before replacing the Vite static deploy with TanStack Start:

1. Generate the route tree; never hand-edit `apps/web/src/routeTree.gen.ts`.
2. Prove the investor document route still renders on desktop and mobile.
3. Run `pnpm --dir apps/web test`, `pnpm check:route-tree`,
   `pnpm smoke:web-static`, `pnpm smoke:hosted`, `pnpm smoke:hosted:browser`,
   `pnpm smoke:hosted:a11y`, and `pnpm smoke:hosted:visual`.
4. Document whether the deploy is Cloudflare Pages static output or Cloudflare
   Workers SSR.
5. Document rollback to the previous static deploy.

When running on the headless host, wrap deploys in the secret environment:

```bash
headless-bws-env exec -- pnpm deploy:cloudflare
```

## Provider Notes

- Vercel: configure the project root as the repo root and output directory as
  `apps/web/dist/client`.
- Cloudflare Pages: use the same build command and output directory.
- Convex backend: provision separately before enabling live data routes.
- API docs: the backend docs route is authored at
  `packages/convex/confect/http.ts`.
