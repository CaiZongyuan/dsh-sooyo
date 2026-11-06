# Working on `dsh-sooyo`

A DSH plugin bundle managed with `pnpm`. The Host half (`index.js`, `daily.js`, `personal.js`, `core/`, `sync/`, `agent/`, `feed.js`) owns the Source registry, durable store, command funnel, HTTP routes, Hub/Client sync, and Agent tools. The Client half (`client.js`) renders Boards and Widgets from `/sooyo/daily` and sends one named action per interaction.

The plugin runs in one of three roles (`standalone` by default, `hub`, `client`) via config — all three serve the same UI and tools through `SooyoService`.

## Context pointers (read before touching the relevant area)

- **Domain language (`Board`, `Widget`, `Hub`, `Intent`, `Precondition`, `Proposal`…):** [`GLOSSARY.md`](./GLOSSARY.md) — use these exact terms in code, API payloads, and UI.
- **Architectural decisions (Widget vs. Source, single authoritative Hub):** [`docs/adr/`](./docs/adr/)
- **Hub/Client wire protocol, migration, and 3-instance E2E checks:** [`docs/sync.md`](./docs/sync.md)
- **Client UI, bento packer (`ov=0`), CSS resets, and container queries:** [`docs/ui-and-layout.md`](./docs/ui-and-layout.md)
- **Testing & CI policy, real DSH Playwright E2E, and pre-release smoke:** [`docs/testing.md`](./docs/testing.md)
- **Adding a Source, `feed.js` fixtures, and `og:image` thumbnail rules:** [`docs/sources.md`](./docs/sources.md)
- **Generating Widget Type icons (`.webp` in `assets/a/`):** [`docs/agents/image-generation.md`](./docs/agents/image-generation.md)

## File map

| File | Role |
|---|---|
| `index.js` | Host entry: `SOURCES` registry, fetch + store + `/sooyo/*` routes, role wiring |
| `daily.js` | Personal data models & mutators (Boards, Widgets, layouts, Tasks, Notes, Read Later, habits, focus); exports `ACTIONS` |
| `personal.js` | Widget Type registry, Sizes, grid footprints, default Boards, Widget normalisation |
| `client.js` | Client half: `main` panel, `sidebar.panellist` icon, packed bento grid, Widget renderers |
| `feed.js` | RSS 2.0 / Atom / RDF reader + `og:image` extraction |
| `core/protocol.js` | Protocol version, error codes, command whitelist, `LOCAL_ONLY`, `ENTITY_TABLE` |
| `core/store.js` | Revision bookkeeping, single write queue, two-phase Intent ledger, idempotency, `recover()` |
| `core/commands.js` | The single command funnel: validate → plan → record Intent → apply → bump |
| `core/service.js` | `LocalSooyoService` facade |
| `core/migrate.js` | Operational Backup & Portable Export / dry-run import / apply |
| `sync/routes.js` | Authenticated Hub API `/sooyo/sync/v1/*` |
| `sync/remote.js` | `RemoteSooyoService`: Client's Host-side proxy, Replica cache & Outbox |
| `agent/tools.js` | Sooyo Agent tools + `renderContextBlock` |
| `agent/context.js` | `agent/pre-step` Context Bridge (`source.kind = plugin:sooyo`) |
| `agent/review.js` | Deterministic Review scan, revision cursor, schedule prompt |
| `agent/inbox.js` | Proposals: create, decide, apply, rollback, expire |
| `dev/selftest.mjs` | Offline self-test: runs real `apply()` against a fake context |
| `tests/e2e/` | Real isolated DSH + Playwright E2E & visual verification (`dsh-fixture.mjs`, `ui.spec.mjs`, `sync.spec.mjs`) |

## Always-on invariants

1. **Never import from `node_modules` in runtime Host files.** `plugin_manager install_bundle` links the bundle without `--preserve-symlinks`, so unbundled bare specifiers fail to resolve at runtime. Use Node built-ins (`node:*`) and relative imports only (`pnpm run check` enforces this).
2. **Host changes require a DSH restart; Client (`client.js`) hot-reloads on save.** Node's ESM cache keys by resolved file URL. Verify Host logic via `pnpm run test:offline` before restarting.
3. **Storage keys must match `/^[a-zA-Z0-9_-]+$/` and table names `/^[a-z][a-z0-9_]*$/`.** Never use colons or slashes in record keys (`itemKey()` and `layoutKey()` sanitise them).
4. **Every mutation goes through `core/commands.js` `execute()` and the single write queue.** Never mutate `daily.js` or storage tables outside the queue/stamper, or ETag/Revision and crash recovery will drift.
5. **Deterministic entity IDs and two-phase Intents.** Creating commands must derive stable entity IDs from `operationId` (or accept validated client IDs) and persist a `pending` Intent before mutating tables, so crash recovery and retries never duplicate records.
6. **A `client` role never opens the authoritative `sooyo` storage domain.** No local seed, no feed fetch. If the Hub is unreachable, serve the non-authoritative Replica cache marked `stale: true` or report an explicit connection error — never fabricate an empty dashboard.
7. **`proposal.decide` is human-only.** Never expose Proposal approval in `/sooyo/sync/v1/command` or in Agent tools; remote approval goes exclusively through `/sooyo/sync/v1/inbox/decide` triggered by user UI interaction.
8. **Authentication precedes body parsing in `/sooyo/sync/v1/*`.** Legacy `/sooyo/*` routes enforce `isLoopback`. Sync tokens live in Host config/env only — never in responses, URLs, or `client.js`.
9. **Agent Context Bridge messages must carry `source.kind = plugin:sooyo`** and only inject when `hasHumanInput()` is true.
10. **Never edit repo files with PowerShell `Set-Content` or string redirection.** PowerShell 5.1 writes ANSI without UTF-8 BOM and corrupts Chinese text into `U+FFFD`. Use file edit tools or Node `fs.writeFileSync(..., 'utf8')`.
11. **Documentation hygiene.** Keep `AGENTS.md` lean. Put detailed reference in `docs/` behind a pointer above, update `GLOSSARY.md` when domain concepts evolve, and **delete obsolete handoff/draft docs immediately** once superseded or delivered.

## Testing & CI Policy

1. **CI defaults to one Workflow, one Ubuntu Job:** fast check/typecheck/build + `pnpm run test:offline`.
2. **UI changes use real DSH + Playwright (`pnpm run test:e2e`), and the coding Agent must inspect the Desktop/Mobile screenshots.**
3. **Sync / Storage / Agent changes run the corresponding E2E spec; small isolated edits do not require full multi-instance E2E on every step.**
4. **Pre-release smoke must verify real package installation (`pnpm pack`), startup, core UI flow, and Hub/Client sync when applicable.**
5. **Without a concrete problem and clear benefit, never add extra CI workflows, OS/version matrices, scheduled jobs, extra test frameworks, or paid visual services.**
6. **Failures must fail loudly:** never swallow errors, delete assertions, or silently `skip` tests to manufacture green builds.
7. **Existing data-safety tests in `dev/selftest.mjs` must be preserved;** simplify redundant harnesses rather than lowering business correctness guarantees.

```sh
pnpm run check         # syntax + no-bare-imports + UTF-8 check
pnpm run test:offline  # offline fixtures, personal store, sync protocol, crash recovery, CSS guards (CI)
pnpm run test:e2e      # real isolated DSH + Playwright E2E (UI, persistence, Hub/Client sync, screenshots)
```
