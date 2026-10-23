# Gota documentation

The project's memory, by domain, so each task loads only what it needs.

## Loading matrix
| If the task touches… | Read first | Then |
|---|---|---|
| Drawing or fixing icons | [`DESIGN.md`](../DESIGN.md) | [Format](./format.md) · [Production](./production.md) |
| An icon's format (`fill`, `small`, `parts`, `motion`, `levels`, languages…) | [Format](./format.md) | [`DESIGN.md`](../DESIGN.md) |
| `engine/` (geometry, variants, 16 px, mirroring, motion, transitions, search) | [Engine](./engine.md) | [Quality](./quality.md) |
| `scripts/build.mjs`, `dist/`, the components, the package, the MCP server, or what gets published | [Build](./build.md) | [Roadmap](./roadmap.md) |
| Launching or planning a round of agents | [Production](./production.md) | [Taxonomy](./taxonomy.md) · [Quality](./quality.md) · [Roadmap](./roadmap.md) |
| Which category an icon belongs to, or a new category | [Taxonomy](./taxonomy.md) | [Production](./production.md) |
| QA, tests, review sheets | [Quality](./quality.md) | [Engine](./engine.md) |
| Proposing something new | [Decisions](./decisions.md) | [Roadmap](./roadmap.md) |

## Maintenance contract
- A rule lives in one document only; the others link to it.
- A change to the format, the engine, or the outputs updates its document in the same commit.
- Every new decision (accepted, done differently, or rejected) goes into [Decisions](./decisions.md) with its reason.
- Every session that moves the project forward adds its entry to [History](./history.md) and marks the progress in [Roadmap](./roadmap.md).
- Every file, function, field, or command mentioned exists in today's code.
