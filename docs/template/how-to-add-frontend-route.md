# How To Add A Frontend Route

Use the frontend route generator:

```bash
pnpm template:add-client-domain -- --name reports --system <canonical-id> --disposition reuse
```

## Files Created

- Route file.
- Screen.
- Feature adapter.
- Blocks or block composition.
- Route tests and docs.

## Tests

- route manifest;
- loading state;
- empty state;
- ready/read state;
- ready/edit state when editable;
- mutation success;
- typed failure;
- skipped query;
- transport failure.

## Gates

- `pnpm --dir apps/web test src/features/<feature>`
- `pnpm check:route-tree`
- `pnpm check:layer-boundaries`
