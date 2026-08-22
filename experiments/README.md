# Experiments

This is the low-friction sandbox. Prototype freely here; nothing below this
directory is part of the production runtime, schema, route tree, job schedule,
headless registry, or provider registry.

Start with:

```bash
pnpm template:prototype -- --name <name> --system <canonical-id> --disposition reuse|extend --hypothesis "<what we expect to learn>" --write
```

Each experiment lives at `experiments/<system>/<name>/` and carries an
`experiment.json` contract. Production code must never import it. Promotion is a
deliberate re-scaffold through the matching `template:add-*` generator, followed
by the production gates and contract review. Copy knowledge and tested behavior
across that boundary; do not move sandbox registration code into the runtime
unchanged.
