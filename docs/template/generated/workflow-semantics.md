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
| WF-GRAPH-SCHEMA-VERSION | `graph.schemaVersion` | supported | Mapped through the canonical Maestro workflow authoring path. | Use the named typed constructor and rerun pnpm check:workflow:fast. |
| WF-GRAPH-ARGS-SCHEMA | `graph.argsSchemaName` | supported | Mapped through the canonical Maestro workflow authoring path. | Use the named typed constructor and rerun pnpm check:workflow:fast. |
| WF-GRAPH-RETURN-SCHEMA | `graph.returnSchemaName` | supported | Mapped through the canonical Maestro workflow authoring path. | Use the named typed constructor and rerun pnpm check:workflow:fast. |
| WF-GRAPH-PRINCIPAL-SCHEMA | `graph.principalSchemaName` | supported | Mapped through the canonical Maestro workflow authoring path. | Use the named typed constructor and rerun pnpm check:workflow:fast. |
| WF-GRAPH-POLICY-POSTURE | `graph.policyPosture` | supported | Mapped through the canonical Maestro workflow authoring path. | Use the named typed constructor and rerun pnpm check:workflow:fast. |
| WF-GRAPH-KICKOFF-PROFILES | `graph.kickoffProfiles` | supported | Mapped through the canonical Maestro workflow authoring path. | Use the named typed constructor and rerun pnpm check:workflow:fast. |
| WF-GRAPH-UNSTABLE-ARGS | `graph.unstableArgs` | supported | Mapped through the canonical Maestro workflow authoring path. | Use the named typed constructor and rerun pnpm check:workflow:fast. |
| WF-NODE-ID | `graph.nodes[].id` | supported | Mapped through the canonical Maestro workflow authoring path. | Use the named typed constructor and rerun pnpm check:workflow:fast. |
| WF-NODE-KIND | `graph.nodes[].kind` | supported | Mapped through the canonical Maestro workflow authoring path. | Use the named typed constructor and rerun pnpm check:workflow:fast. |
| WF-NODE-LABEL | `graph.nodes[].label` | supported | Mapped through the canonical Maestro workflow authoring path. | Use the named typed constructor and rerun pnpm check:workflow:fast. |
| WF-NODE-CAPABILITY | `graph.nodes[].capability` | supported | Mapped through the canonical Maestro workflow authoring path. | Use the named typed constructor and rerun pnpm check:workflow:fast. |
| WF-NODE-AGENT | `graph.nodes[].agent` | supported | Mapped through the canonical Maestro workflow authoring path. | Use the named typed constructor and rerun pnpm check:workflow:fast. |
| WF-NODE-DELAY | `graph.nodes[].delayMs` | supported | Mapped through the canonical Maestro workflow authoring path. | Use the named typed constructor and rerun pnpm check:workflow:fast. |
| WF-NODE-STEP-NAME | `graph.nodes[].stepName` | supported | Mapped through the canonical Maestro workflow authoring path. | Use the named typed constructor and rerun pnpm check:workflow:fast. |
| WF-NODE-PAYLOAD-POLICY | `graph.nodes[].payloadPolicy` | intentionally-restricted | WP-1.1 validates payload metadata but does not enforce budgets at the capability boundary. | Keep generated bounded defaults until the WP-1.6 payload compiler and size fixtures land. |
| WF-NODE-SEMANTIC-RULES | `graph.nodes[].semanticRuleIds` | supported | Mapped through the canonical Maestro workflow authoring path. | Use the named typed constructor and rerun pnpm check:workflow:fast. |
| WF-NODE-FUNCTION-KIND | `graph.nodes[].functionKind` | intentionally-restricted | WP-1.1 accepts the discriminant while executable V2 node compilation remains disabled. | Use the source-to-output starter graph until the WP-1.2 exact step compiler lands. |
| WF-NODE-SCHEDULE | `graph.nodes[].schedule` | intentionally-restricted | Durable schedule options are not compiled by the WP-1.1 bootstrap runner. | Use an unscheduled node until the WP-1.11 scheduling compiler and horizon fixtures land. |
| WF-NODE-TRANSACTION | `graph.nodes[].transaction` | intentionally-restricted | Inline and independent transaction options await exact query/mutation step compilation. | Use the source-to-output starter graph until WP-1.2 maps transaction posture. |
| WF-NODE-EVENT-DEFINITION | `graph.nodes[].eventDefinition` | intentionally-restricted | Typed event execution is not enabled by the WP-1.1 bootstrap runner. | Wait for the typed event compiler and ownership fixtures before adding an event node. |
| WF-NODE-EVENT-SCHEMA | `graph.nodes[].eventSchemaName` | intentionally-restricted | Event validators are recorded but not yet bound to component await/send operations. | Use the generated event path after its compiler and validator fixture land. |
| WF-NODE-EVENT-INSTANCE | `graph.nodes[].eventInstanceKey` | intentionally-restricted | Event instance ownership is not yet compiled by the V2 bootstrap runner. | Wait for the generated workflow/generation/tenant event ownership boundary. |
| WF-NODE-SUBWORKFLOW | `graph.nodes[].workflow` | intentionally-restricted | The V2 bootstrap runner rejects executable subworkflow nodes. | Use the starter graph until the unscheduled typed child compiler lands. |
| WF-NODE-CHILD-VERSION | `graph.nodes[].childVersion` | intentionally-restricted | Child version bindings are validated but not executed by the V2 bootstrap runner. | Use a generated pinned child only after the subworkflow compiler fixtures land. |
| WF-NODE-RETRY | `graph.nodes[].retry` | supported | Mapped through the canonical Maestro workflow authoring path. | Use the named typed constructor and rerun pnpm check:workflow:fast. |
| WF-RETRY-MAX-ATTEMPTS | `graph.nodes[].retry.maxAttempts` | supported | Mapped through the canonical Maestro workflow authoring path. | Use the named typed constructor and rerun pnpm check:workflow:fast. |
| WF-RETRY-BACKOFF | `graph.nodes[].retry.backoffMs` | intentionally-restricted | Backoff is not yet compiled into action retry behavior. | Set backoffMs to 0 or use a reviewed capability-owned retry seam. |
| WF-RETRY-INITIAL-BACKOFF | `graph.nodes[].retry.initialBackoffMs` | supported | Mapped through the canonical Maestro workflow authoring path. | Use the named typed constructor and rerun pnpm check:workflow:fast. |
| WF-RETRY-BASE | `graph.nodes[].retry.base` | supported | Mapped through the canonical Maestro workflow authoring path. | Use the named typed constructor and rerun pnpm check:workflow:fast. |
| WF-SCHEDULE-KIND | `graph.nodes[].schedule.kind` | intentionally-restricted | WP-1.1 does not compile runAfter or runAt options. | Omit scheduling until WP-1.11 adds exact option and horizon fixtures. |
| WF-SCHEDULE-DELAY | `graph.nodes[].schedule.delayMs` | intentionally-restricted | WP-1.1 does not compile delayed node starts. | Use an explicit delay node or wait for WP-1.11 schedule support. |
| WF-SCHEDULE-TIMESTAMP | `graph.nodes[].schedule.timestamp` | intentionally-restricted | WP-1.1 does not compile timestamp node starts. | Omit runAt until WP-1.11 validates the scheduling horizon. |
| WF-PAYLOAD-MAX-INPUT | `graph.nodes[].payloadPolicy.maxInputBytes` | intentionally-restricted | The bootstrap runner does not enforce pre-component input budgets. | Keep the generated bounded value until WP-1.6 adds getConvexSize enforcement. |
| WF-PAYLOAD-MAX-RESULT | `graph.nodes[].payloadPolicy.maxResultBytes` | intentionally-restricted | The bootstrap runner does not enforce capability result budgets. | Keep the generated bounded value until WP-1.6 adds pre-return enforcement. |
| WF-PAYLOAD-RESULT-MODE | `graph.nodes[].payloadPolicy.resultMode` | intentionally-restricted | Artifact projection is not compiled by the WP-1.1 bootstrap runner. | Use inline generated defaults until the artifact-reference compiler lands. |
| WF-TRANSACTION-KIND | `graph.nodes[].transaction.kind` | intentionally-restricted | WP-1.1 does not compile query/mutation transaction posture. | Wait for WP-1.2 exact query/mutation call mapping; do not model it as action retry. |
| WF-TRANSACTION-LIMITS | `graph.nodes[].transaction.limits` | intentionally-restricted | Inline transaction limits are not passed to a step by the bootstrap runner. | Use no executable V2 node until WP-1.2 compiles the complete limits object. |
| WF-TRANSACTION-BYTES-READ | `graph.nodes[].transaction.limits.bytesRead` | intentionally-restricted | The WP-1.1 bootstrap runner does not compile inline transaction limits. | Wait for the WP-1.2 exact transactionLimits mapping. |
| WF-TRANSACTION-BYTES-WRITTEN | `graph.nodes[].transaction.limits.bytesWritten` | intentionally-restricted | The WP-1.1 bootstrap runner does not compile inline transaction limits. | Wait for the WP-1.2 exact transactionLimits mapping. |
| WF-TRANSACTION-DATABASE-QUERIES | `graph.nodes[].transaction.limits.databaseQueries` | intentionally-restricted | The WP-1.1 bootstrap runner does not compile inline transaction limits. | Wait for the WP-1.2 exact transactionLimits mapping. |
| WF-TRANSACTION-DOCUMENTS-READ | `graph.nodes[].transaction.limits.documentsRead` | intentionally-restricted | The WP-1.1 bootstrap runner does not compile inline transaction limits. | Wait for the WP-1.2 exact transactionLimits mapping. |
| WF-TRANSACTION-DOCUMENTS-WRITTEN | `graph.nodes[].transaction.limits.documentsWritten` | intentionally-restricted | The WP-1.1 bootstrap runner does not compile inline transaction limits. | Wait for the WP-1.2 exact transactionLimits mapping. |
| WF-TRANSACTION-FUNCTIONS-SCHEDULED | `graph.nodes[].transaction.limits.functionsScheduled` | intentionally-restricted | The WP-1.1 bootstrap runner does not compile inline transaction limits. | Wait for the WP-1.2 exact transactionLimits mapping. |
| WF-TRANSACTION-SCHEDULED-ARGS-BYTES | `graph.nodes[].transaction.limits.scheduledFunctionArgsBytes` | intentionally-restricted | The WP-1.1 bootstrap runner does not compile inline transaction limits. | Wait for the WP-1.2 exact transactionLimits mapping. |
| WF-KICKOFF-NAME | `graph.kickoffProfiles[].name` | supported | Mapped through the canonical Maestro workflow authoring path. | Use the named typed constructor and rerun pnpm check:workflow:fast. |
| WF-KICKOFF-MODE | `graph.kickoffProfiles[].mode` | supported | Mapped through the canonical Maestro workflow authoring path. | Use the named typed constructor and rerun pnpm check:workflow:fast. |
| WF-KICKOFF-DEFAULT | `graph.kickoffProfiles[].default` | supported | Mapped through the canonical Maestro workflow authoring path. | Use the named typed constructor and rerun pnpm check:workflow:fast. |
| WF-UNSTABLE-ARGS-ENABLED | `graph.unstableArgs.enabled` | supported | Mapped through the canonical Maestro workflow authoring path. | Use the named typed constructor and rerun pnpm check:workflow:fast. |
| WF-UNSTABLE-ARGS-ADR | `graph.unstableArgs.adrRef` | supported | Mapped through the canonical Maestro workflow authoring path. | Use the named typed constructor and rerun pnpm check:workflow:fast. |
| WF-POLICY-KIND | `graph.policyPosture.kind` | supported | Mapped through the canonical Maestro workflow authoring path. | Use the named typed constructor and rerun pnpm check:workflow:fast. |
| WF-POLICY-NONE-REASON | `graph.policyPosture.reason` | supported | Mapped through the canonical Maestro workflow authoring path. | Use the named typed constructor and rerun pnpm check:workflow:fast. |
| WF-POLICY-SCHEMA | `graph.policyPosture.schemaName` | supported | Mapped through the canonical Maestro workflow authoring path. | Use the named typed constructor and rerun pnpm check:workflow:fast. |
| WF-POLICY-VERSION | `graph.policyPosture.policyVersionId` | supported | Mapped through the canonical Maestro workflow authoring path. | Use the named typed constructor and rerun pnpm check:workflow:fast. |
| WF-POLICY-HASH | `graph.policyPosture.policyHash` | supported | Mapped through the canonical Maestro workflow authoring path. | Use the named typed constructor and rerun pnpm check:workflow:fast. |
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
