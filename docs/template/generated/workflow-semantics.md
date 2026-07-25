# Generated Workflow Semantics

Generated from `packages/template-core/src/workflow-semantics/contract.ts`. Do
not edit by hand.

<!-- prettier-ignore -->
| Rule | Subject | Status | Reason | Repair |
| --- | --- | --- | --- | --- |
| WF-GRAPH-ID | `graph.id` | supported | Mapped through the canonical Maestro workflow authoring path. | Use the named typed constructor and rerun pnpm check:workflow:fast. |
| WF-GRAPH-VERSION | `graph.version` | supported | Mapped through the canonical Maestro workflow authoring path. | Use the named typed constructor and rerun pnpm check:workflow:fast. |
| WF-GRAPH-START | `graph.startNodeId` | supported | Mapped through the canonical Maestro workflow authoring path. | Use the named typed constructor and rerun pnpm check:workflow:fast. |
| WF-GRAPH-NODES | `graph.nodes` | supported | Mapped through the canonical Maestro workflow authoring path. | Use the named typed constructor and rerun pnpm check:workflow:fast. |
| WF-GRAPH-EDGES | `graph.edges` | supported | Mapped through the canonical Maestro workflow authoring path. | Use the named typed constructor and rerun pnpm check:workflow:fast. |
| WF-GRAPH-JOINS | `graph.joins` | supported | Mapped through the canonical Maestro workflow authoring path. | Use the named typed constructor and rerun pnpm check:workflow:fast. |
| WF-NODE-ID | `graph.nodes[].id` | supported | Mapped through the canonical Maestro workflow authoring path. | Use the named typed constructor and rerun pnpm check:workflow:fast. |
| WF-NODE-KIND | `graph.nodes[].kind` | supported | Mapped through the canonical Maestro workflow authoring path. | Use the named typed constructor and rerun pnpm check:workflow:fast. |
| WF-NODE-LABEL | `graph.nodes[].label` | supported | Mapped through the canonical Maestro workflow authoring path. | Use the named typed constructor and rerun pnpm check:workflow:fast. |
| WF-NODE-CAPABILITY | `graph.nodes[].capability` | supported | Mapped through the canonical Maestro workflow authoring path. | Use the named typed constructor and rerun pnpm check:workflow:fast. |
| WF-NODE-AGENT | `graph.nodes[].agent` | supported | Mapped through the canonical Maestro workflow authoring path. | Use the named typed constructor and rerun pnpm check:workflow:fast. |
| WF-NODE-DELAY | `graph.nodes[].delayMs` | supported | Mapped through the canonical Maestro workflow authoring path. | Use the named typed constructor and rerun pnpm check:workflow:fast. |
| WF-NODE-RETRY | `graph.nodes[].retry` | intentionally-restricted | Current graph retry metadata is validated but not faithfully mapped for actions. | Use maxAttempts 1 until the Phase 1 action retry compiler and dedupe fixtures land. |
| WF-RETRY-ATTEMPTS | `graph.nodes[].retry.maxAttempts` | intentionally-restricted | Attempts above one are not yet compiled into step options. | Set maxAttempts to 1 or wait for the Phase 1 retry mapping. |
| WF-RETRY-BACKOFF | `graph.nodes[].retry.backoffMs` | intentionally-restricted | Backoff is not yet compiled into action retry behavior. | Set backoffMs to 0 or use a reviewed capability-owned retry seam. |
| WF-EDGE-ID | `graph.edges[].id` | supported | Mapped through the canonical Maestro workflow authoring path. | Use the named typed constructor and rerun pnpm check:workflow:fast. |
| WF-EDGE-SOURCE | `graph.edges[].sourceNodeId` | supported | Mapped through the canonical Maestro workflow authoring path. | Use the named typed constructor and rerun pnpm check:workflow:fast. |
| WF-EDGE-TARGET | `graph.edges[].targetNodeId` | supported | Mapped through the canonical Maestro workflow authoring path. | Use the named typed constructor and rerun pnpm check:workflow:fast. |
| WF-EDGE-CONDITION | `graph.edges[].condition` | supported | Mapped through the canonical Maestro workflow authoring path. | Use the named typed constructor and rerun pnpm check:workflow:fast. |
| WF-EDGE-EXPRESSION | `graph.edges[].condition.expression` | supported | Mapped through the canonical Maestro workflow authoring path. | Use the named typed constructor and rerun pnpm check:workflow:fast. |
| WF-JOIN-NODE | `graph.joins[].nodeId` | supported | Mapped through the canonical Maestro workflow authoring path. | Use the named typed constructor and rerun pnpm check:workflow:fast. |
| WF-JOIN-STRATEGY | `graph.joins[].strategy` | supported | Mapped through the canonical Maestro workflow authoring path. | Use the named typed constructor and rerun pnpm check:workflow:fast. |
| WF-JOIN-SOURCES | `graph.joins[].sourceNodeIds` | supported | Mapped through the canonical Maestro workflow authoring path. | Use the named typed constructor and rerun pnpm check:workflow:fast. |
| WF-DEFINE | `primitive.defineWorkflow` | supported | Mapped through the canonical Maestro workflow authoring path. | Use the named typed constructor and rerun pnpm check:workflow:fast. |
| WF-STEP-QUERY | `primitive.runQuery` | supported | Mapped through the canonical Maestro workflow authoring path. | Use the named typed constructor and rerun pnpm check:workflow:fast. |
| WF-STEP-MUTATION | `primitive.runMutation` | supported | Mapped through the canonical Maestro workflow authoring path. | Use the named typed constructor and rerun pnpm check:workflow:fast. |
| WF-STEP-ACTION | `primitive.runAction` | intentionally-restricted | Actions require explicit retry and idempotency posture not yet compiled. | Use a mutation/query capability or wait for the Phase 1 action strategy compiler. |
| WF-CHILD-SCHEDULE | `primitive.runWorkflow` | unsupported | Workflow 0.4.4 drops required scheduled-child option propagation. | Schedule a parent capability or use an unscheduled child only after Phase 1 support lands. |
| WF-STEP-SLEEP | `primitive.sleep` | supported | Mapped through the canonical Maestro workflow authoring path. | Use the named typed constructor and rerun pnpm check:workflow:fast. |
| WF-STEP-EVENT | `primitive.awaitEvent` | supported | Mapped through the canonical Maestro workflow authoring path. | Use the named typed constructor and rerun pnpm check:workflow:fast. |
| WF-START-EAGER | `primitive.start.eagerFirstPoll` | supported | Mapped through the canonical Maestro workflow authoring path. | Use the named typed constructor and rerun pnpm check:workflow:fast. |
| WF-START-QUEUED | `primitive.start.queued` | supported | Mapped through the canonical Maestro workflow authoring path. | Use the named typed constructor and rerun pnpm check:workflow:fast. |
| WF-STATUS | `primitive.status` | supported | Mapped through the canonical Maestro workflow authoring path. | Use the named typed constructor and rerun pnpm check:workflow:fast. |
| WF-CANCEL | `primitive.cancel` | supported | Mapped through the canonical Maestro workflow authoring path. | Use the named typed constructor and rerun pnpm check:workflow:fast. |
| WF-RESTART | `primitive.restart` | supported | Mapped through the canonical Maestro workflow authoring path. | Use the named typed constructor and rerun pnpm check:workflow:fast. |
| WF-CLEANUP | `primitive.cleanup` | supported | Mapped through the canonical Maestro workflow authoring path. | Use the named typed constructor and rerun pnpm check:workflow:fast. |
| WF-LIST | `primitive.list` | supported | Mapped through the canonical Maestro workflow authoring path. | Use the named typed constructor and rerun pnpm check:workflow:fast. |
| WF-LIST-NAME | `primitive.listByName` | supported | Mapped through the canonical Maestro workflow authoring path. | Use the named typed constructor and rerun pnpm check:workflow:fast. |
| WF-LIST-STEPS | `primitive.listSteps` | supported | Mapped through the canonical Maestro workflow authoring path. | Use the named typed constructor and rerun pnpm check:workflow:fast. |
| WF-SEND-EVENT | `primitive.sendEvent` | supported | Mapped through the canonical Maestro workflow authoring path. | Use the named typed constructor and rerun pnpm check:workflow:fast. |
| WF-CREATE-EVENT | `primitive.createEvent` | intentionally-restricted | Application-created raw EventIds bypass generated event ownership. | Use the generated send/await event contract. |
| WF-HANDLER-DATE | `primitive.Date` | supported | Mapped through the canonical Maestro workflow authoring path. | Use the named typed constructor and rerun pnpm check:workflow:fast. |
| WF-HANDLER-RANDOM | `primitive.Math.random` | supported | Mapped through the canonical Maestro workflow authoring path. | Use the named typed constructor and rerun pnpm check:workflow:fast. |
| WF-HANDLER-INTL | `primitive.Intl` | intentionally-restricted | Pinned runtime does not normalize locale or timezone behavior. | Format with explicit locale/timezone in a capability and journal the result. |
| WF-HANDLER-CRYPTO | `primitive.crypto` | unsupported | Cryptographic randomness is removed from replay handlers. | Generate values in a capability step and journal the result. |
