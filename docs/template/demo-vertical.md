# Demo Vertical: Source-Grounded Brief

The first reusable vertical is `source-grounded-brief`. It demonstrates a
flexible AI Brain without defaulting to RAG or Maestro-specific GTM logic.

## Flow

1. **Brain source set:** synthetic markdown notes and links describe a client or
   workspace context.
2. **Context pack:** selected sources are normalized into a compact context
   bundle with titles, freshness, and provenance.
3. **Prompt policy snapshot:** model behavior is resolved from the policy and
   prompt registry, then pinned for the run.
4. **Fake/live-gated LLM completion:** fake mode returns deterministic markdown;
   live mode must pass env, spend, rate-limit, and provider checks.
5. **Capability result:** `sourceGroundedBrief` returns typed markdown, source
   titles, model receipt, policy snapshot, and trust claim.
6. **Workflow run row:** a workflow can compose the capability as one durable
   stage.
7. **Evidence snapshot:** inputs, source references, and material output facts
   are fingerprinted.
8. **Trust Receipt:** reviewers can inspect what sources and policies produced
   the result.
9. **API/CLI/MCP exposure:** the same capability can be described and invoked
   headlessly through generated surfaces.
10. **Reference app page:** the Saas UI business app explains the slice through
    Brain, workflow, receipt, provider, and settings sections.

## Non-Goals

- No RAG or vector search by default.
- No external publish side effect.
- No broad agent autonomy.
- No Maestro-specific GTM content.
- No live provider requirement for local demos.

## Proof Points

- `packages/convex/confect/capabilities/sourceGroundedBrief.*`
- `packages/convex/confect/workflows/*`
- `packages/convex/confect/agents/*`
- `examples/generic-ai-ops/evals/source-grounded-brief.cases.json`
- `tooling/evals/src/source-grounded-brief.test.ts`
