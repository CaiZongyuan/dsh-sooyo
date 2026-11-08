# Working on `dsh-sooyo`

A DSH plugin bundle managed with `pnpm`, authored in strict TypeScript (`src/shared/`, `src/host/`) and React TSX (`src/client/`), and compiled via `esbuild` (`dev/build.mjs`) into two zero-build root artifacts: `index.js` (Host ESM bundle) and `client.js` (DSH `__ModuleLoader__` Client bundle).

The plugin runs in one of three roles (`standalone` by default, `hub`, `client`) via config — all three serve the same UI and tools through `SooyoService`.

## Context pointers (read before touching the relevant area)

- **Domain language (`Board`, `Widget`, `Hub`, `Intent`, `Precondition`, `Proposal`…):** [`GLOSSARY.md`](./GLOSSARY.md) — use these exact terms in code, API payloads, and UI.
- **Architectural decisions (Widget vs. Source, single authoritative Hub):** [`docs/adr/`](./docs/adr/)
- **Hub/Client wire protocol, migration, and 3-instance E2E checks:** [`docs/sync.md`](./docs/sync.md)
- **Client UI, bento packer (`ov=0`), CSS resets, and container queries:** [`docs/ui-and-layout.md`](./docs/ui-and-layout.md)
- **Testing & CI policy, real DSH Playwright E2E, and pre-release smoke:** [`docs/testing.md`](./docs/testing.md)
- **Adding a Source, `feed-parser.ts` fixtures, and `og:image` thumbnail rules:** [`docs/sources.md`](./docs/sources.md)
- **AIHOT changelog/guide readers, plugin update detection, and `__SOOYO_BUILD__`:** [`docs/upstream.md`](./docs/upstream.md)
- **Generating Widget Type icons (`.webp` in `assets/a/`):** [`docs/agents/image-generation.md`](./docs/agents/image-generation.md)

## File map

| File | Role |
|---|---|
| `src/shared/` | Shared TypeScript contracts (`domain.ts`, `commands.ts`, `sync.ts`, `widget.ts`, `schemas.ts`) |
| `src/host/index.ts` | Host entry: `SOURCES` registry, fetch + store + `/sooyo/*` routes, role wiring |
| `src/host/sources/` | `feed-parser.ts` (RSS 2.0 / Atom / RDF + `og:image`), `fetch.ts`, `registry.ts` |
| `src/host/domain/` | `personal.ts` (Widget Types, Sizes, footprints, defaults), `daily.ts` (models & mutators), `commands.ts` (single command funnel) |
| `src/host/core/` | `protocol.ts`, `store.ts` (revision + two-phase Intent ledger + `recover()`), `service.ts` (`LocalSooyoService`), `migrate.ts` (Backup & Portable Export) |
| `src/host/sync/` | `routes.ts` (`/sooyo/sync/v1/*`), `remote.ts` (`RemoteSooyoService`, Replica cache & Outbox) |
| `src/host/agent/` | `tools.ts`, `context.ts` (Context Bridge), `review.ts` (Review scan & cursor), `inbox.ts` (Proposals) |
| `src/client/index.ts` | Client entry: `main` panel & `sidebar.panellist` registration |
| `src/client/SooyoPanel.tsx` | Top-level panel state, 4-view navigation (`home`, `content`, `schedule`, `retro`), command palette, theme, and delegated actions |
| `src/client/views/` | `Stamps.tsx` (daily stamps & streak), `Cards.tsx` (multimedia collection cards & capture/detail modals), `ContentView.tsx`, `ScheduleView.tsx`, `RetroView.tsx` |
| `src/client/shell/` | `BoardTabs.tsx`, `WidgetGrid.tsx`, `WidgetFrame.tsx`, `WidgetGallery.tsx`, `WidgetSettings.tsx` |
| `src/client/widgets/` | `registry.ts`, `shared.tsx`, and feature-based TSX Widgets (`task/`, `subscription/`, `capture/`, `notes/`, `bookmarks/`, `project/`, `readlater/`, `habit/`, `focus/`, `agent-inbox/`) |
| `src/client/layout/` | `breakpoints.ts` (`columnsFor`, `footprint`, `fitDom`), `bento-packer.ts` (`pack`, `startDrag`, `startResize`) |
| `src/client/styles/tokens.css` | Scoped CSS variables, resets, container queries, and dark palette |
| `dev/build.mjs` | `esbuild` bundler generating root `index.js` and `client.js` |
| `dev/selftest.mjs` | Offline self-test: runs real `apply()` against a fake context |
| `tests/e2e/` | Real isolated DSH + Playwright E2E & visual verification (`dsh-fixture.ts`, `ui.spec.ts`, `sync.spec.ts`) |

## Always-on invariants

1. **Never import from `node_modules` in runtime Host files (`src/host/**` / `index.js`).** `plugin_manager install_bundle` links the bundle without `--preserve-symlinks`, so unbundled bare specifiers fail to resolve at runtime. Use Node built-ins (`node:*`) and relative imports only (`pnpm run check` enforces this).
2. **Never bundle a duplicate copy of React in `client.js`.** `dev/build.mjs` wraps the Client bundle in `window.__ModuleLoader__.load` and resolves `react` via `require('react')`. Rebuild (`pnpm run build`) after editing `src/**`.
3. **Host changes require a DSH restart; Client (`client.js`) hot-reloads on save.** Node's ESM cache keys by resolved file URL. Verify Host logic via `pnpm run test:offline` before restarting.
4. **Storage keys must match `/^[a-zA-Z0-9_-]+$/` and table names `/^[a-z][a-z0-9_]*$/`.** Never use colons or slashes in record keys (`itemKey()` and `layoutKey()` sanitise them).
5. **Every mutation goes through `src/host/domain/commands.ts` `execute()` and the single write queue.** Never mutate `daily.ts` or storage tables outside the queue/stamper, or ETag/Revision and crash recovery will drift.
6. **Deterministic entity IDs and two-phase Intents.** Creating commands must derive stable entity IDs from `operationId` (or accept validated client IDs) and persist a `pending` Intent before mutating tables, so crash recovery and retries never duplicate records.
7. **A `client` role never opens the authoritative `sooyo` storage domain.** No local seed, no feed fetch. If the Hub is unreachable, serve the non-authoritative Replica cache marked `stale: true` or report an explicit connection error — never fabricate an empty dashboard.
8. **`proposal.decide` is human-only.** Never expose Proposal approval in `/sooyo/sync/v1/command` or in Agent tools; remote approval goes exclusively through `/sooyo/sync/v1/inbox/decide` triggered by user UI interaction.
9. **Authentication precedes body parsing in `/sooyo/sync/v1/*`.** Legacy `/sooyo/*` routes enforce `isLoopback`. Sync tokens live in Host config/env only — never in responses, URLs, or `client.js`.
10. **Agent Context Bridge messages must carry `source.kind = plugin:sooyo`** and only inject when `hasHumanInput()` is true.
11. **Never edit repo files with PowerShell `Set-Content` or string redirection.** PowerShell 5.1 writes ANSI without UTF-8 BOM and corrupts Chinese text into `U+FFFD`. Use file edit tools or Node `fs.writeFileSync(..., 'utf8')`.
12. **Documentation hygiene.** Keep `AGENTS.md` lean. Put detailed reference in `docs/` behind a pointer above, update `GLOSSARY.md` when domain concepts evolve, and **delete obsolete handoff/draft docs immediately** once superseded or delivered.

## Testing & CI Policy

1. **CI defaults to one Workflow, one Ubuntu Job:** fast `pnpm run typecheck` + `pnpm run build` + `pnpm run check` + `pnpm run test:offline`.
2. **UI changes use real DSH + Playwright (`pnpm run test:e2e`), and the coding Agent must inspect the Desktop/Mobile screenshots.**
3. **Sync / Storage / Agent changes run the corresponding E2E spec; small isolated edits do not require full multi-instance E2E on every step.**
4. **Pre-release smoke must verify real package installation (`pnpm pack`), startup, core UI flow, and Hub/Client sync when applicable.**
5. **Without a concrete problem and clear benefit, never add extra CI workflows, OS/version matrices, scheduled jobs, extra test frameworks, or paid visual services.**
6. **Failures must fail loudly:** never swallow errors, delete assertions, or silently `skip` tests to manufacture green builds.
7. **Existing data-safety tests in `dev/selftest.mjs` must be preserved;** simplify redundant harnesses rather than lowering business correctness guarantees.

```sh
pnpm run typecheck     # strict tsc check for Host, Client TSX, and E2E suites
pnpm run build         # esbuild bundle src/host/index.ts -> index.js & src/client/index.ts -> client.js
pnpm run check         # syntax + no-bare-imports + React external + UTF-8 check
pnpm run test:offline  # offline fixtures, personal store, sync protocol, crash recovery, CSS guards (CI)
pnpm run test:e2e      # real isolated DSH + Playwright E2E (UI, persistence, 3-instance Hub/Client sync, screenshots)
```
