# Protected CI bootstrap

Woodpecker's server-side controller is the only producer of
`ci/woodpecker/pr/verify`. Candidate commits run without GitHub, BWS, deploy,
provider, host-home, SSH-agent, Docker-socket, or controller-storage access.

The required firewall validates candidate lockfiles against the reviewed
dependency allowlist, scrubs CI secrets, and performs a frozen, scriptless fetch
inside Woodpecker's disposable container. Candidate lockfiles may select only
artifacts already present in that allowlist; `.pnpmfile.cjs`, lifecycle scripts,
and unreviewed package versions fail before a build starts.

`protected-bootstrap.mts` is preview-first. Every transition binds its exact
confirmation argv to the journal and live-state digest. The protected operator,
not candidate code, supplies GitHub/Woodpecker adapters and credentials. Keep
the temporary and canonical contexts overlapped until two fresh merge candidates
prove the canonical controller, then remove the temporary context with the same
compare-and-swap journal. Qlty runs separately for 30 seconds and is advisory
for absence, findings, provider failure, process failure, and timeout.

Never run an external confirmation from a candidate checkout. Observe the
current protected `main`, review the journal and controller digest with a
non-author owner, and execute the returned argv byte-for-byte from the protected
operator environment.

## Optional hardened dependency network

When installed, a protected controller may start the allowlisted dependency
proxy before launching the candidate and install an egress policy that denies
every destination except that proxy. It passes `DEPENDENCY_PROXY_WIRED=1`,
`DEPENDENCY_PROXY_NETWORK_MODE=shared-proxy`,
`DEPENDENCY_PROXY_EGRESS_POLICY_SHA256=sha256:<64 hex>`, and a healthy
`DEPENDENCY_PROXY_URL` into the controller-owned launcher. The candidate sandbox
rejects missing or malformed attestations and performs a proxy health check
before package resolution; it never treats the environment flag as a replacement
for the controller's firewall/policy installation.
