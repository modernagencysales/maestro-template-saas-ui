---
planSchemaVersion: 1
productContract: product.contract.yaml
workPackages:
  - id: WP-REC-001
    behaviorIds:
      - BHV-REC-001
      - BHV-REC-002
      - BHV-REC-003
      - BHV-REC-004
    appMapTargets:
      - route:$workspace/records
      - headless:records-api
    work:
      kind: fixture-to-real
      target: examples/saas-application/seed/source/tests/acceptance
      persistenceOrProviderBoundary:
        The generated customer backend and CLI share the local records HTTP
        boundary.
      followUpGates:
        - Four tagged Playwright examples are discovered natively.
        - Task 5 runs the examples against a generated customer.
      frontend:
        screenCatalogId: starter-route:apps/web/src/routes/_app/$workspace/_dashboard/contacts/index.tsx
        sourceReceipt: docs/template/saas-ui-starter-files.json
        shellId: app-shell
        allowedAdaptations:
          - route-binding
          - data-adapter
          - mutation-adapter
          - product-label-icon
          - compatibility-seam
        requiredVisualStates:
          - loading
          - empty
          - error
          - populated
          - selected
          - mutation
proofs:
  - behavior: BHV-REC-001
    behaviorRevision: 1
    level: black-box
    surfaces: [web-ui, cli-process]
    observation:
      A title saved through the web form is listed by the primary workspace CLI.
    failureWitness:
      The primary CLI listing omits the title saved through the web form.
  - behavior: BHV-REC-002
    behaviorRevision: 1
    level: black-box
    surfaces: [cli-process, web-ui]
    observation:
      A title created by the primary CLI is visible in the web record list.
    failureWitness:
      The web record list omits the title created by the primary CLI.
  - behavior: BHV-REC-003
    behaviorRevision: 1
    level: black-box
    surfaces: [cli-process, web-ui]
    observation:
      A missing-key create reports the denial and the authorized primary CLI and
      web list omit its title.
    failureWitness:
      The CLI accepts the missing-key create or an authorized list shows its
      title.
  - behavior: BHV-REC-004
    behaviorRevision: 1
    level: black-box
    surfaces: [cli-process]
    observation:
      A key bound to the primary workspace is denied when creating in the
      observer workspace, and both authorized lists omit the title.
    failureWitness:
      The CLI accepts the cross-workspace create or either authorized list shows
      its title.
---

# Scope Guard

This seed defines the Records walking skeleton and its black-box Playwright
proofs. It is not a runnable application root; Task 5 owns generated-customer
execution.

# Quality Targets

The four examples remain revision-bound to the product contract, use only public
web and CLI surfaces, and share one disposable backend through the runtime
support. The revision-bound Playwright proof reuses the same Records runtime
mechanics.

# Test Plan

- `a web-created record appears in the CLI` covers BHV-REC-001.
- `a CLI-created record appears in the web app` covers BHV-REC-002.
- `a missing API key cannot create a record` covers BHV-REC-003.
- `a workspace-bound key cannot write to another workspace` covers BHV-REC-004.
- Runtime support tests cover the shared API base, native proxy response
  preservation, safe proxy failure, and diagnostic redaction.
