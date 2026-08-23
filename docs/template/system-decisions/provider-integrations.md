# provider-integrations

Disposition: introduce  
Decision owner: Maestro platform  
Status: approved

## Distinct Lifecycle

Provider Integrations owns the workspace-scoped lifecycle of a customer's
external connections: which provider is available, whether authorization is in
progress, active, failed, or revoked, and which generation of an authorization
may be used. This lifecycle is visible in Connections and is independent from
the actions or content later performed through a provider.

## Existing Systems Considered

- `access-and-tenancy`: authenticates Maestro users and workspaces; it must not
  own third-party provider grants.
- `action-automation`: owns approved external actions after a connection exists;
  it must consume connection authority rather than create or revoke it.
- `knowledge-brain`: consumes connected source material; it does not own OAuth
  or provider authorization state.
- `policy-and-prompts`: may govern which providers are enabled but does not own
  their connection lifecycle.

## Authority And Persistence

- Canonical entrypoints:
  - `packages/convex/confect/integrations/connections.spec.ts`
  - `packages/integrations/src/providerAdapter.ts`
- Responsibilities:
  - list workspace provider connection state;
  - begin and complete provider authorization through a narrow adapter;
  - revoke a connection with a generation fence;
  - expose only redacted status and provider metadata to product surfaces.
- Table: `providerConnections`.
- The Pro IntegrationCard screen, web callbacks, workflows, and headless tools
  are projections or delegates of the same authority.

## Migration And Preservation

The superseded `product/maestro-brain` branch contains Slack/Nango-specific
authorization code. It is evidence for required behaviors, error cases, and
generation fencing, not a filesystem to merge. Preserve tenant binding,
single-use connect sessions, generation fencing, redaction, retryable provider
failures, and connect/disconnect behavior through generic contracts. Do not copy
its custom Connections UI or make Nango identifiers product authority.

## Terminal Condition

The system is real when one catalog owner covers `providerConnections`, public
operations enforce workspace roles, provider secrets remain adapter-local,
connect completion and revocation are generation-fenced and idempotent, the Pro
IntegrationCard is driven by the typed state, and fake/test/live modes fail
closed according to their declared provider configuration.
