---
name: planning
description:
  Use when drafting or revising implementation plans and subplans in this
  repository.
---

Read `AGENTS.md`, especially the Working Loop planning bullets. Plan in this
order:

1. Create or select behavior IDs in `product.contract.yaml`.
2. Write typed plan frontmatter with existing `WorkPackageSchema` classification
   and current App Map targets.
3. Design the black-box proof and failure witness before implementation.
4. Add focused unit/integration tests only for named implementation risks.
5. Generate docs, check the contract, and run required acceptance.
6. Promote draft to required only with its revision-bound passing example.
7. Run `pnpm maestro -- verify --scope full` once on the immutable delivery head
   and inspect its exact-head receipt.

Then draft each plan or subplan as work-packages:

- `fixture-to-real`: name the existing fixture module, the real
  persistence/provider boundary, and focused gates.
- `pattern-instance`: name the exact `pnpm template:*` command, generated
  target, and follow-up gates from the matching `docs/template/how-to-add-*`
  playbook.
- `template-gap`: name the missing template pattern, template backlog reference,
  and proposed promotion/import path.

For generator-backed work, dry-run the generator when needed to enumerate files.
Do not copy rule text from AGENTS, rule coverage, or playbooks into the plan;
link to the source of truth and keep the plan focused on targets, commands, and
verification.
