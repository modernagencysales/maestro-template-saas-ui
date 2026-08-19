# Saas UI Pro

This repository contains the source code for Saas UI Pro.

- `@saas-ui-pro/*`: All pro packages
- `apps/*`: Demo applications (https://demo.saas-ui.dev)
- `blocks`: Pre-built components (https://saas-ui.dev/blocks)

## Next.js starter kit

The Next.js starter kit has been moved to [a new repository](https://github.com/saas-js/saas-ui-pro-nextjs-starter-kit).
If you don't have access yet, drop a message on Discord.

## Getting started

First of all thanks a lot for signing up!

Come say hello at [Discord](https://discord.gg/4PmJGFcAjX), your feedback is very much appreciated.

- [Documentation](https://saas-ui.dev/docs/pro/overview)
- [Roadmap](https://roadmap.saas-ui.dev)
- [Storybook](https://storybook.saas-ui.pro)

## Installation

Clone the repository

```bash
git clone https://github.com/saas-js/saas-ui-pro.git
```

Once you have a copy of the source on your computer, run PNPM install to install all dependencies.

```bash
pnpm -i
```

Run the Next.js demo application

```bash
pnpm dev:demo
```

## Install Pro blocks

Pro application blocks are installed as editable source through the Saas UI
CLI. Authenticate with the account that has Pro access, then add the block by
its registry name:

```bash
npx @saas-ui/cli login
npx @saas-ui/cli add <pro-block-name>
```

The CLI installs public and Pro registry dependencies into the project and
records explicitly requested roots in `components.json`. Runtime
`@saas-ui-pro/*` packages, where still required, are documented separately and
should not be installed merely to consume a source block.

Projects migrating from `@saas-ui/react` should follow the public repository's
[`@saas-ui/react` migration guide](https://github.com/saas-js/saas-ui/blob/v3/MIGRATION.md).

## License

See [LICENSE](./LICENSE).
