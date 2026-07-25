# WP-1.3 Generator Integration

The generator currently uses the exact structural shape of Agent A's pending
failure-policy authority so it can remain based on `48b0776` without copying
semantic validation.

When A lands `WorkflowFailurePolicy`, replace the local adapter declaration in
`tooling/generators/src/workflow-predeploy.ts` with this single authority
binding:

```ts
export type GeneratedWorkflowFailurePolicy = WorkflowFailurePolicy<
  string,
  string
>;
```

The Convex graph schema separately binds the same authority with:

```ts
failurePolicy: S.optional(makeWorkflowFailurePolicySchema(WorkflowCapabilityReference, WorkflowStepName)),
```

No runner or generator should redefine the safe-failure validators. Generated
runners already derive their route type directly from
`RunDurableGraphV2CompilerInput["failureRoutes"]`; no follow-up binding is
needed on the runtime side.
