---
name: planning
description:
  Use when drafting or revising implementation plans and subplans in this
  repository.
---

Read `AGENTS.md`, especially the Working Loop planning bullets. Then draft each
plan or subplan as work-packages:

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
