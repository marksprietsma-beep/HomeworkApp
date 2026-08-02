# Technical architecture

## Goals and technology

The client is a Vite-powered React application written in strict TypeScript. React renders
and gathers input; it is not the game engine. The simulation must remain usable in Vitest,
a worker, or a future CLI without a DOM or React. Version 0.1 requires no backend: authored
content ships in the bundle and persistence adapters will use browser storage.

## Source layout and dependency boundaries

| Folder | Responsibility | May depend on |
| --- | --- | --- |
| `src/domain` | Versioned state and command types | Other domain types only |
| `src/simulation` | Pure command validation and state transitions | Domain and content |
| `src/content` | Immutable, authored game data | Domain types |
| `src/world-generation` | Replaceable generator ports and adapters | Domain types |
| `src/persistence` | Save/load ports and browser adapters | Domain types |
| `src/ui` | React components and application orchestration | All public layers |

Dependencies point inward: domain code imports no React, browser, persistence, or generator
implementation. Simulation code imports neither React nor browser APIs and performs no I/O.
Persistence and generation are interfaces at the boundary, injected by application startup.
Azgaar is intentionally not integrated. A future adapter may implement
`WorldGeneratorProvider`; campaign/domain state must not expose provider-specific types.

Avoid broad barrel exports between layers. Use `import type` for type-only dependencies.
Files use kebab-case, React components use PascalCase, and functions/variables use camelCase.
Prefer readonly domain data, explicit return types at public boundaries, pure functions, and
discriminated unions over classes and mutation.

## Command and state flow

```text
user event -> React UI -> typed GameCommand -> simulation reducer
                                           -> new GameState
new GameState -> UI render + persistence port -> browser adapter
```

The UI translates an event into a serializable command. The simulation validates/reduces
that command against the current state and returns a new state; it never calls React or
storage. The application layer publishes the result to the UI and asks the persistence port
to save it. Loading and world creation occur through injected ports before commands are
processed. Randomness will likewise be supplied explicitly as a seeded service, never read
from `Math.random()` in simulation code. Commands, state, and `GameWorld` are versioned so
future migrations can be explicit and saved games remain supportable.

## Content, generation, and persistence

Content modules contain data, not stateful services, and are treated as immutable inputs.
World generation receives an explicit seed and returns the provider-neutral, versioned
`GameWorld`. Persistence serializes versioned domain state and is responsible for storage
errors and migrations. Neither boundary may leak its implementation into domain models.

## Testing and quality gates

- Co-locate unit tests as `*.test.ts(x)`. Test simulation transitions as deterministic pure
  functions and use fixed inputs/seeds. UI tests may use a DOM environment when introduced.
- Every bug fix should include a regression test. Substitute test adapters at port boundaries;
  do not mock domain functions.
- `npm test`, `npm run lint`, `npm run format:check`, and `npm run build` must pass before merge.
- Prettier owns layout; ESLint owns correctness. Do not hand-format against Prettier.
- Pull requests should be narrowly scoped and use typed interfaces rather than reaching
  across folder boundaries. CI installs from the lockfile and runs all quality gates.
