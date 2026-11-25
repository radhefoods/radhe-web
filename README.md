# Radhe Foods customer shop

The customer-facing web shop of Radhe Foods, `www.radhefoods.de`: Indian groceries in Germany, sold from stock and paid at checkout. It talks to the Radhe Foods API (`radhe-api`); it has no database and no secrets of its own.

- Next.js 16 (App Router, React 19, TypeScript strict), Tailwind CSS 4, next-intl
- English and German with localised addresses (`/en/cart`, `/de/warenkorb`)
- Runs on Hostinger (`main`) and on Vercel (`production/vercel`) from the same code

## Documentation

Everything about the shop is documented in [`docs/`](docs/README.md), written from the code and checked against it.

| To                                           | Read                                                               |
| -------------------------------------------- | ------------------------------------------------------------------ |
| Find anything                                | [docs/README.md](docs/README.md): the index                        |
| See what the shop can do, and in which state | [docs/features/README.md](docs/features/README.md)                 |
| Understand how it is built                   | [docs/architecture/overview.md](docs/architecture/overview.md)     |
| Call the API                                 | [docs/api/README.md](docs/api/README.md)                           |
| Keep the look                                | [docs/design-system/README.md](docs/design-system/README.md)       |
| Work on it                                   | [docs/development/conventions.md](docs/development/conventions.md) |
| Release it                                   | [docs/deployment/README.md](docs/deployment/README.md)             |
| Know why something is the way it is          | [docs/decisions/README.md](docs/decisions/README.md)               |

## Quick start

Node.js 24 and npm.

```bash
npm install
cp .env.example .env.local

npm run dev:mock   # terminal 1: the mock API on http://localhost:3000
npm run dev        # terminal 2: the shop on http://localhost:3001
```

Open <http://localhost:3001>. The mock API stands in for the backend: [docs/development/mock-api.md](docs/development/mock-api.md). Every script and the first steps are in [docs/development/getting-started.md](docs/development/getting-started.md).

## Before a commit

```bash
npm run check                    # types, lint, formatting, unit tests
node docs/tools/check-docs.mjs   # the documentation against the code
```

A push to `main` is a release on Hostinger. The browser tests, the build check and what they do not see are in [docs/development/testing.md](docs/development/testing.md).

## Three rules

1. **The API decides.** Prices, VAT, stock, the bill and delivery fees come from the backend; the shop shows them and calculates none of them.
2. **The look is the owner's.** Theme, colours, the font and the brand stay; a change of the look is asked for first.
3. **Code and document change together.** A change is not done until its document says what the code does.

The rest is in [docs/development/conventions.md](docs/development/conventions.md).
