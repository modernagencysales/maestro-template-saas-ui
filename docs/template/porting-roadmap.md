# Template Porting Roadmap

Status: real execution roadmap.

This roadmap records when seams become live provider integrations. The detailed
implementation order lives in
`docs/superpowers/plans/2026-07-01-maestro-template-porting-implementation-plan.md`.

## Maestro Agent Pack Order

The canonical
[agent-pack productization plan](../superpowers/plans/2026-07-24-maestro-agent-pack-productization-plan.md)
uses this blocking order:

1. Phase 0 doctrine, pinned compatibility, behavioral fixtures, and the
   executable workflow semantics ledger.
2. In parallel after Phase 0, the workflow-optional customer alpha and the
   workflow runtime correctness track.
3. Architecture map and ADR governance after alpha evidence.
4. Existing-app adoption and one-prior-tag upgrades.
5. Promotion, host conformance, and release evidence.

Workflow correctness precedes public agent-pack distribution and every published
workflow claim. The earlier workflow-optional alpha may proceed only when the
semantics ledger rejects unsupported workflow primitives and the alpha makes no
workflow compatibility claim. Stable gap identifiers AP-001 through AP-014 live
in [`porting-backlog.md`](./porting-backlog.md).

## Provider Gateway

- Rate limiting starts as a fake/test limiter in
  `packages/integrations/src/rateLimit.ts`.
- The real `@convex-dev/rate-limiter` component is wired only after headless API
  keys, workspace tenancy, usage attribution, billing ledger rows, and provider
  error envelopes are in place.
- The real component adapter must implement the `ConvexRateLimiterAdapter` shape
  and preserve the same typed `RateLimitDeniedError` mapping.
- Workflows and agents may consume rate-limit decisions through capabilities;
  they must not call the Convex component directly.
