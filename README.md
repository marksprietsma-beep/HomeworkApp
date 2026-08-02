# Guild Management RPG

A deep, incremental fantasy guild-management web game. Milestone 0.1 establishes the
frontend and simulation boundaries; it deliberately contains no gameplay systems.

## Stack

- Vite, React, and strict TypeScript
- Vitest for unit tests
- ESLint and Prettier for static analysis and formatting
- GitHub Actions for pull-request verification

Node.js 22 and npm are recommended. No backend, database, accounts, or hosted services are
required for v0.1; campaigns will be local-first.

## Commands

```bash
npm install
npm run dev       # start Vite's development server
npm test          # run the unit suite once
npm run build     # type-check and create a production bundle
npm run lint
npm run format:check
```

See [`docs/architecture.md`](docs/architecture.md) for repository conventions, dependency
rules, state flow, and testing standards.
