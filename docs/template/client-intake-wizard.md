# Client Intake Wizard

`pnpm template:intake -- --name "Client Brain" --write` creates
`docs/template/generated/client-intake.md` and updates `template-instance.json`
with an `intake` block.

Use it before custom business logic work. The wizard keeps discovery focused on
the reusable app-factory primitives: Brain sources, workflows, capabilities,
agents, providers, approvals, Trust Receipts, and handoff risk.

## What It Produces

- `template-instance.json`: records intake status, generated timestamp,
  blueprint, and generated brief path.
- `docs/template/generated/client-intake.md`: a structured discovery brief for a
  B2B AI/GTM implementation.

## Wizard Sections

### Business Outcome

Capture the first useful business result, the weekly user, and the output that
would prove the app understands the company.

### Source Inventory

List authoritative sources such as markdown, links, notes, calls, CRM exports,
product docs, enablement docs, or approved internal systems. Each source needs
an owner, export posture, delete posture, retention rule, and redaction posture.

### Domain Map

Translate the client’s language into template nouns: workspace, source, context
pack, capability, workflow, agent, and Trust Receipt. Rename nouns through
generators before hand-writing bespoke code.

### First Workflow

Define the first source-to-output path: source set, capability, approval,
reviewer, Trust Receipt, and output destination. Keep React Flow as the
interaction layer and durable workflow graphs as data.

### Agents And Capabilities

Name the first agent, the tools it may call, the capabilities it can compose,
and the operations that require approval before publish, send, spend, or delete.

### Provider Posture

Keep WorkOS, PostHog, Dodo, provider-neutral email, LLM, storage, search,
notifications, and payments in fake/test mode until ownership, data handling,
and secret names are approved.

### Handoff Risks

Make fake/seam/planned labels explicit. RAG remains optional; source-backed
context, markdown/links/notes/documents, and Trust Receipts are the default
truth model.

## Recommended Loop

```bash
pnpm template:quickstart -- --name "Client Brain" --write
pnpm template:intake -- --name "Client Brain" --write
pnpm template:doctor -- --mode fake
pnpm template:handoff -- --mode fake --write
```

After the intake is reviewed, add the first client noun, capability, workflow,
and private package through generators.
