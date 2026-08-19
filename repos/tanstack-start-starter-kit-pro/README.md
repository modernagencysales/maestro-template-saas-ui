# Tanstack Start starter kit pro

Welcome to Saas.js

This starter kit gives you all the basic building blocks to build top tier products with Tanstack Start.

Tech used:

- [Saas UI](https://saas-ui.dev/)
- [Vite](https://vitejs.dev/)
- [Tanstack Start](https://tanstack.com/start)
- [tRPC](https://trpc.io/)
- [Better Auth](https://better-auth.com/)
- [Stripe](https://stripe.com)

## Getting started

To get started you can follow the instructions below.

For more information and detailed guides please visit [the official documentation](https://beta.saas-ui.dev/docs/starter-kits/tanstack-router).

## Installation

### Cloning the starter project

Clone this repository to get started.

```bash
git clone --single-branch --branch=main git@github.com:saas-js/tanstack-start-starter-kit-pro.git my-project
```

[Read full instructions to clone this repository](https://saas-js.com/docs/starter-kits/tanstack-start/installation/clone-repository).

Install the dependencies.

```bash
pnpm
```

Create a `.env` file:

```bash
pnpm init:env
```

    > If you're on Windows, you need to manualy link or copy the .env to `apps/web/.env`.

Start the local database and run database migrations:

```bash
docker-compose up && yarn db:migrate
```

## Running the app

To run the app, use the following command:

```bash
pnpm dev:web
```

## License

See [LICENSE](./LICENSE).
