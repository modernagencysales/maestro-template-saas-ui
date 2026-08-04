# Protected CI bootstrap

Woodpecker's server-side controller is the only producer of
`ci/woodpecker/pr/verify`. Candidate commits run without GitHub, BWS, deploy,
provider, host-home, SSH-agent, Docker-socket, or controller-storage access.

The controller image contains the reviewed dependency allowlist and launches
`candidate-sandbox.mts` with Bubblewrap. Candidate lockfiles may select only
artifacts already present in that allowlist; `.pnpmfile.cjs`, lifecycle scripts,
unreviewed registry origins, redirects, private destinations, oversized
responses, and unsafe archive entries fail before a build starts.

`protected-bootstrap.mts` is preview-first. Every transition binds its exact
confirmation argv to the journal, live-state digest, operation nonce, operator
identity, and expiry. Confirmations are single-use and updates hold an exclusive
journal lock. Per-document pending/written/verified progress is saved after
every external operation so a restarted process can resume or roll back a mixed
partial write. The protected operator uses only its built-in fixed GitHub,
Woodpecker, and versioned controller HTTP routes; it never loads a candidate
adapter module. Keep the temporary and canonical contexts overlapped until two
fresh merge candidates prove the canonical controller, then remove the temporary
context with the same compare-and-swap journal. Qlty runs separately for 30
seconds and is advisory for absence, findings, provider failure, process
failure, and timeout.

Never run an external confirmation from a candidate checkout. Observe the
current protected `main`, review the journal and controller digest with a
non-author owner, and execute the returned argv byte-for-byte from the protected
operator environment.

`observe` accepts typed `--repository`, `--base-ref`, `--base-oid`,
`--controller-image-digest`, `--app-id`, `--github-ruleset-id`,
`--temporary-context`, and `--operator` inputs. Transition bodies and inverse
requests are derived by the operator; callers cannot supply opaque resource
documents. `verify --stage temporary|canonical-overlap|canonical` performs a
read-only exact postimage check. `rollback --step <id>` is compare-and-swap and
replay protected like forward transitions.

GitHub rulesets use the documented repository ruleset resource and Woodpecker
repository metadata uses `/api/repos/<owner>/<repo>`. Protected producer and
secret-reference state is not a Woodpecker API invention: it is served by the
separate controller contract at `/v1/repositories/<owner>/<repo>/...`. The
operator requires `PROTECTED_CONTROLLER_API_VERSION=maestro.protected-ci/v1`, an
HTTPS `PROTECTED_CONTROLLER_API_URL`, and a controller token, and rejects
missing versions or malformed provider responses before a write.

## Candidate dependency network

The protected controller starts the allowlisted dependency proxy on the fixed
`/controller/proxy/dependency.sock` Unix socket. Bubblewrap always creates a new
network namespace and read-only binds only that socket and the immutable
runtime. The runtime bridges the socket to candidate loopback for the duration
of each package-manager command. The candidate therefore has no shared host
network and no route to an upstream registry, controller service, or arbitrary
destination.

The image entrypoint is a fixed dispatcher. `candidate-install` starts the
embedded proxy, waits for its Unix socket, launches the sandbox, and tears the
proxy down. `canary` performs the same path with an empty locked package,
asserts the sandbox environment contains only its explicit variables, proves a
direct registry request cannot escape the network namespace, and completes a
proxy-backed fetch plus offline install. Run this on the Linux agent before
publishing or accepting an image digest.
