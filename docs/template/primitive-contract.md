# Effectified-Full Primitive Contract

A reusable template primitive is complete only when another app can copy the
primitive and keep its backend contract, workflow behavior, frontend state, and
headless surfaces intact.

## Required Contract Pack

Each primitive includes these pieces:

- Pure domain module with deterministic planners, reducers, schemas, or view
  derivation. It does not import Convex ctx, generated refs, React, provider
  SDKs, ambient time, random, or process env.
- Effect Schema arg, return, persisted-row, and public error schemas using
  Confect-compatible schema constructs.
- Confect 10 `*.spec.ts`/`*.impl.ts` pair with lazy schema thunks, generated
  table wrappers, generated `databaseSchema`, typed public errors, and
  `GroupImpl.finalize`.
- Internal workflow-step ref when the primitive can be called from
  `@convex-dev/workflow`.
- Effect service boundaries for config, clock, principal/auth, provider clients,
  storage, and observability.
- Generated surface manifest metadata for web, API, CLI, MCP, OpenAPI, and
  Scalar. Surface exposure defaults to none.
- Frontend view-model state when the primitive is visible in the app. React
  renderers consume view states; they do not import backend Effect programs.
- Tests for domain behavior, Confect typed errors, generated refs, manifest
  parity, workflow dispatch eligibility, and frontend view states.
- Authoring docs that name the runtime boundary, typed errors, surfaces,
  workflow-step eligibility, and copy checklist.

## Runtime Boundary

Effect and Confect define the contract layer. Pure domain modules and React
renderers stay plain TypeScript where that makes the primitive easier to reuse.
Workflow replay handlers stay plain Convex `defineWorkflow` files; Confect owns
start/status/control contracts and dispatchable capability refs.
