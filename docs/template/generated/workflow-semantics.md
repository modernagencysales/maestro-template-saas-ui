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
| WF-NODE-FAILURE-POLICY | `graph.nodes[].failurePolicy` | supported | Mapped through the canonical Maestro workflow authoring path. | Use the named typed constructor and rerun pnpm check:workflow:fast. |
| WF-FAILURE-POLICY-KIND | `graph.nodes[].failurePolicy.kind` | supported | Mapped through the canonical Maestro workflow authoring path. | Use the named typed constructor and rerun pnpm check:workflow:fast. |
| WF-FAILURE-EDGE | `graph.nodes[].failurePolicy.edgeId` | supported | Mapped through the canonical Maestro workflow authoring path. | Use the named typed constructor and rerun pnpm check:workflow:fast. |
| WF-FAILURE-ENVELOPE | `graph.nodes[].failurePolicy.failure` | supported | Mapped through the canonical Maestro workflow authoring path. | Use the named typed constructor and rerun pnpm check:workflow:fast. |
| WF-FAILURE-COMPENSATION-STEPS | `graph.nodes[].failurePolicy.steps` | supported | Mapped through the canonical Maestro workflow authoring path. | Use the named typed constructor and rerun pnpm check:workflow:fast. |
| WF-FAILURE-COMPENSATION-NODE | `graph.nodes[].failurePolicy.steps[].forNodeId` | supported | Mapped through the canonical Maestro workflow authoring path. | Use the named typed constructor and rerun pnpm check:workflow:fast. |
| WF-FAILURE-COMPENSATION-CAPABILITY | `graph.nodes[].failurePolicy.steps[].capability` | supported | Mapped through the canonical Maestro workflow authoring path. | Use the named typed constructor and rerun pnpm check:workflow:fast. |
| WF-FAILURE-COMPENSATION-STEP | `graph.nodes[].failurePolicy.steps[].stepName` | supported | Mapped through the canonical Maestro workflow authoring path. | Use the named typed constructor and rerun pnpm check:workflow:fast. |
| WF-FAILURE-TAG | `graph.nodes[].failurePolicy.failure._tag` | supported | Mapped through the canonical Maestro workflow authoring path. | Use the named typed constructor and rerun pnpm check:workflow:fast. |
| WF-FAILURE-CODE | `graph.nodes[].failurePolicy.failure.code` | supported | Mapped through the canonical Maestro workflow authoring path. | Use the named typed constructor and rerun pnpm check:workflow:fast. |
| WF-FAILURE-MESSAGE | `graph.nodes[].failurePolicy.failure.message` | supported | Mapped through the canonical Maestro workflow authoring path. | Use the named typed constructor and rerun pnpm check:workflow:fast. |
| WF-FAILURE-UNDECLARED-ROUTE | `behavior.failureRouting.undeclared` | intentionally-restricted | Implicit error-edge or compensation routing hides settled sibling behavior. | Declare nodes[].failurePolicy or retain fail behavior. |
| WF-NODE-FUNCTION-KIND | `graph.nodes[].functionKind` | supported | Mapped through the canonical Maestro workflow authoring path. | Use the named typed constructor and rerun pnpm check:workflow:fast. |
| WF-NODE-SCHEDULE | `graph.nodes[].schedule` | intentionally-restricted | Durable schedule options are not compiled by the WP-1.1 bootstrap runner. | Use an unscheduled node until the WP-1.11 scheduling compiler and horizon fixtures land. |
| WF-NODE-TRANSACTION | `graph.nodes[].transaction` | supported | Mapped through the canonical Maestro workflow authoring path. | Use the named typed constructor and rerun pnpm check:workflow:fast. |
| WF-NODE-EVENT-DEFINITION | `graph.nodes[].eventDefinition` | supported | Mapped through the canonical Maestro workflow authoring path. | Use the named typed constructor and rerun pnpm check:workflow:fast. |
| WF-NODE-EVENT-SCHEMA | `graph.nodes[].eventSchemaName` | supported | Mapped through the canonical Maestro workflow authoring path. | Use the named typed constructor and rerun pnpm check:workflow:fast. |
| WF-NODE-EVENT-INSTANCE | `graph.nodes[].eventInstanceKey` | supported | Mapped through the canonical Maestro workflow authoring path. | Use the named typed constructor and rerun pnpm check:workflow:fast. |
| WF-NODE-SUBWORKFLOW | `graph.nodes[].workflow` | intentionally-restricted | Exact-version publication binding, cycle/depth/fan-out preflight, durable authority inheritance, bounded payload receipts, and idempotent product-run linkage are implemented; product lifecycle cascade cancellation and cleanup remain restricted. | Keep child cancellation and cleanup restricted until product lifecycle controls can drive and prove cascade execution, reconciliation, quiescence, and retention without relying on unsupported scheduled-child semantics in Workflow 0.4.4. |
| WF-NODE-CHILD-VERSION | `graph.nodes[].childVersion` | supported | Mapped through the canonical Maestro workflow authoring path. | Use the named typed constructor and rerun pnpm check:workflow:fast. |
| WF-BATCH-MAX-ITEMS | `graph.nodes[].maxItems` | supported | Mapped through the canonical Maestro workflow authoring path. | Use the named typed constructor and rerun pnpm check:workflow:fast. |
| WF-BATCH-SIZE | `graph.nodes[].batchSize` | supported | Mapped through the canonical Maestro workflow authoring path. | Use the named typed constructor and rerun pnpm check:workflow:fast. |
| WF-BATCH-FAN-OUT | `graph.nodes[].fanOut` | supported | Mapped through the canonical Maestro workflow authoring path. | Use the named typed constructor and rerun pnpm check:workflow:fast. |
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
| WF-TRANSACTION-KIND | `graph.nodes[].transaction.kind` | supported | Mapped through the canonical Maestro workflow authoring path. | Use the named typed constructor and rerun pnpm check:workflow:fast. |
| WF-TRANSACTION-LIMITS | `graph.nodes[].transaction.limits` | supported | Mapped through the canonical Maestro workflow authoring path. | Use the named typed constructor and rerun pnpm check:workflow:fast. |
| WF-TRANSACTION-BYTES-READ | `graph.nodes[].transaction.limits.bytesRead` | supported | Mapped through the canonical Maestro workflow authoring path. | Use the named typed constructor and rerun pnpm check:workflow:fast. |
| WF-TRANSACTION-BYTES-WRITTEN | `graph.nodes[].transaction.limits.bytesWritten` | supported | Mapped through the canonical Maestro workflow authoring path. | Use the named typed constructor and rerun pnpm check:workflow:fast. |
| WF-TRANSACTION-DATABASE-QUERIES | `graph.nodes[].transaction.limits.databaseQueries` | supported | Mapped through the canonical Maestro workflow authoring path. | Use the named typed constructor and rerun pnpm check:workflow:fast. |
| WF-TRANSACTION-DOCUMENTS-READ | `graph.nodes[].transaction.limits.documentsRead` | supported | Mapped through the canonical Maestro workflow authoring path. | Use the named typed constructor and rerun pnpm check:workflow:fast. |
| WF-TRANSACTION-DOCUMENTS-WRITTEN | `graph.nodes[].transaction.limits.documentsWritten` | supported | Mapped through the canonical Maestro workflow authoring path. | Use the named typed constructor and rerun pnpm check:workflow:fast. |
| WF-TRANSACTION-FUNCTIONS-SCHEDULED | `graph.nodes[].transaction.limits.functionsScheduled` | supported | Mapped through the canonical Maestro workflow authoring path. | Use the named typed constructor and rerun pnpm check:workflow:fast. |
| WF-TRANSACTION-SCHEDULED-FUNCTION-ARGS-BYTES | `graph.nodes[].transaction.limits.scheduledFunctionArgsBytes` | supported | Mapped through the canonical Maestro workflow authoring path. | Use the named typed constructor and rerun pnpm check:workflow:fast. |
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
| WF-WORKPOOL-DUPLICATE-COMPLETION | `compatibility.workpool.duplicateCompletion` | unsupported | Workpool 0.4.7 and candidate 0.4.8 both behaviorally mutate the accepted attempt before checking for an existing pending completion. | Keep production workflow support disabled until Agent B proves a runtime avoidance guard against the same behavioral fixture or the matrix adopts a tested fixed Workpool version. |
| WF-WORKPOOL-CANCEL-RACE | `compatibility.workpool.duplicateCancellation` | unsupported | Workpool 0.4.7 and candidate 0.4.8 both behaviorally process duplicate cancellations concurrently and can double-delete pending work. | Use workflow-optional mode and reject production cancellation activation until Agent B proves serialized idempotent cancellation against the same fixture or the matrix adopts a tested fixed version. |
| WF-DEFINE | `primitive.defineWorkflow` | supported | Mapped through the canonical Maestro workflow authoring path. | Use the named typed constructor and rerun pnpm check:workflow:fast. |
| WF-STEP-QUERY | `primitive.runQuery` | supported | Mapped through the canonical Maestro workflow authoring path. | Use the named typed constructor and rerun pnpm check:workflow:fast. |
| WF-STEP-MUTATION | `primitive.runMutation` | supported | Mapped through the canonical Maestro workflow authoring path. | Use the named typed constructor and rerun pnpm check:workflow:fast. |
| WF-STEP-ACTION | `primitive.runAction` | supported | Mapped through the canonical Maestro workflow authoring path. | Use the named typed constructor and rerun pnpm check:workflow:fast. |
| WF-CHILD-SCHEDULE | `primitive.runWorkflow` | unsupported | Workflow 0.4.4 drops required scheduled-child option propagation. | Use a named sleep followed by an unscheduled child as an explicitly non-equivalent repair, or adopt a tested compatible Workflow upgrade. |
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
| WF-CREATE-EVENT | `primitive.createEvent` | intentionally-restricted | EventId creation remains internal to persisted generation; application-created raw EventIds bypass generated ownership. | Use the generated send/await contract; allocate event instances only through the internal persisted generation path. |
| WF-HANDLER-DATE | `primitive.Date` | supported | Mapped through the canonical Maestro workflow authoring path. | Use the named typed constructor and rerun pnpm check:workflow:fast. |
| WF-HANDLER-RANDOM | `primitive.Math.random` | supported | Mapped through the canonical Maestro workflow authoring path. | Use the named typed constructor and rerun pnpm check:workflow:fast. |
| WF-HANDLER-INTL | `primitive.Intl` | intentionally-restricted | Pinned runtime does not normalize locale or timezone behavior. | Format with explicit locale/timezone in a capability and journal the result. |
| WF-HANDLER-CRYPTO | `primitive.crypto` | unsupported | Cryptographic randomness is removed from replay handlers. | Generate values in a capability step and journal the result. |
