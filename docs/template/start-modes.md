# Local Start Modes

`pnpm maestro -- start` is the customer app's guarded local process launcher.
Run it from the materialized customer target after dependencies are installed.
It reads `template-instance.json`, supervises every child while probing the real
`/health` route, then prints the personalized app name, first outcome, and
actual URL only after readiness succeeds.

## Modes

| Mode             | Processes                        | Prerequisite posture                          |
| ---------------- | -------------------------------- | --------------------------------------------- |
| `fake` (default) | web only                         | No Convex account or live provider secret     |
| `local`          | local Convex, Confect watch, web | Explicit local backend support and free ports |
| `dev`            | `dev:backend`, web               | Authenticated personal Convex dev deployment  |

Use one of:

```bash
pnpm maestro -- start
pnpm maestro -- start --mode local
pnpm maestro -- start --mode dev
```

If a reviewed default conflicts with another service, keep that service running
and choose explicit replacement ports:

```bash
pnpm maestro -- start --mode fake --web-port 15173 --readiness-port 14174
pnpm maestro -- start --mode local --web-port 15173 --convex-port 13210 --convex-site-port 13211 --readiness-port 14174
```

Every override must be a unique integer from 1024 through 65535 for the selected
mode. Maestro applies the values to collision probes, child argv, local Convex
URLs, readiness URLs, and the returned result. It does not silently choose a
random port.

`preview`, `staging`, and `production` are deliberately invalid. Local start
never selects or falls through to production; those stages belong to the
promotion and deployment ladder.

## Safety Contract

Start runs the shared Maestro preflight before any spawn and preserves its exit
classification. A blocked preflight, invalid customer identity, unavailable
dependency, missing dev authentication, or occupied required port cannot leave a
partial process set. A port collision is a blocked start with the occupied port
IDs and an exact non-destructive override rerun. Never stop, kill, or
reconfigure an unknown port owner; use explicit overrides or ask that service's
owner. A missing executable, immediate exit, unsolicited child signal, readiness
error, or readiness timeout is an unavailable dependency. Commands use argv
arrays with the customer target as their exact working directory. Logs are
prefixed by process group and redact bearer tokens and secret-like assignments.

Fake and local children receive fresh environments projected from the injected
base. Fake neutralizes Convex selectors so the documented disconnected fallback
is used. Local neutralizes cloud selectors and pins the web app to
`http://127.0.0.1:3210`; the backend is invoked with explicit `--local`. Only
`dev` may inherit authenticated personal-dev Convex values.

The default reviewed URL is `http://127.0.0.1:5173`; readiness is
`http://127.0.0.1:5173/health`. Start uses strict port binding, so it reports a
collision instead of silently moving the app to a different URL. `local` also
reserves the local Convex ports `3210` and `3211` before spawning. Explicit
overrides remain strict and reproducible.

Ctrl-C and termination signals received by the supervisor are forwarded to every
child and are the only clean shutdown path. Signal arrival closes process
admission immediately, so sequential startup cannot launch another child after
shutdown begins. If one child fails, exits from its own signal, or a later spawn
cannot begin, the supervisor terminates and awaits all children before
returning. The grouped log with the first failure is the repair source; rerun
the same start command after fixing it.

## Supported Fallbacks

The lower-level commands remain available for diagnosis:

```bash
pnpm --dir apps/web dev
pnpm dev:backend
```

They do not provide Maestro's shared preflight, collision check, grouped
redaction, or all-child cleanup contract.
