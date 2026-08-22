# System Introduction Decisions

Create one Markdown file here before adding a canonical system to
`../system-catalog.json`. Use a stable kebab-case filename matching the proposed
system ID.

```markdown
# <system-id>

Disposition: introduce Decision owner: <person/team> Status: proposed | approved
| rejected

## Distinct Lifecycle

What user-visible lifecycle or responsibility is not owned by any current
canonical system?

## Existing Systems Considered

- `<system-id>`: why reuse or extension is incorrect.

## Authority And Persistence

- Canonical entrypoints:
- Responsibilities:
- Tables (existing and proposed):
- Web/API/CLI/MCP/agent projections or delegates:

## Migration And Preservation

What existing implementation, data, behavior, errors, authorization, external
effects, and tests must be migrated or preserved? Write `none` only with
evidence that this is not a replacement.

## Terminal Condition

What proves the system is real rather than a permanent parallel fixture or seam?
```

Only an approved decision may be referenced by a new catalog entry. The contract
reviewer evaluates the semantic distinction; `check:system-catalog` then
enforces exact IDs, paths, responsibilities, and table ownership.
