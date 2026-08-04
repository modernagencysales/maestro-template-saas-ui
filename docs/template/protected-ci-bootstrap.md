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
