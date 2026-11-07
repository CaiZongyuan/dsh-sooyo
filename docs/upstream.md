# Upstream Awareness: AIHOT Guide/Changelog & Plugin Updates

Reference for `src/host/sources/upstream.ts`, `src/host/build-info.ts`, and the
`sooyo_aihot` / `sooyo_update_check` tools.

Two questions this answers, both of which the plugin previously could not:

1. **"What can AIHOT do right now?"** AIHOT adds endpoints and changes their meaning over time
   (weekly/monthly reports, reset monitors, the model leaderboard). An Agent that only knows the
   two endpoints `SOURCES` calls will answer "I can't do that" about a feature that has existed
   for weeks.
2. **"Is this plugin current?"** Upstream moves; nothing in the UI or the prompt said so.

## Why this is not a Source

A `SOURCES` entry produces dashboard Items with a cover, score, category, and per-item read
state. Changelog entries have none of those, and release notes in the bento grid would crowd out
the content the user actually reads. `SOURCES` stays about **content the user reads**;
`upstream.ts` is about **what the Agent knows**. Do not "helpfully" register the changelog as a
Source.

## Readers

| Export | What |
|---|---|
| `createAihotReader` | Fetches `https://aihot.news/changelog`, parses entries, caches by TTL **and** by the page's `aihot-release` stamp |
| `createGuideReader` | Fetches `https://aihot.news/api/v1/agent` (Markdown), caches 6h |
| `createUpdateChecker` | Compares the built commit against `refs/heads/main` of the upstream repo |
| `parseAihotChangelog` | Pure parser, fixture-tested offline |
| `parseRefAdvertisement` | Pure parser for git's pkt-line ref advertisement, fixture-tested offline |
| `describeChangelog` / `describeUpdate` | One-line summaries for the Context Bridge |

`AIHOT` publishes no `ETag`/`Last-Modified` on `/changelog` (it sends
`Cache-Control: public, max-age=299`), so a conditional request is not available. The
`<meta name="aihot-release" content="…">` build stamp is the substitute: the page is fetched, but
an unchanged stamp skips the parse.

## Changelog page shape

Verified against the live page; re-check before trusting the parser if entries stop appearing.

```html
<section id="d-2026-11-07">
  <h2><time dateTime="2026-11-07">2026 年 11 月 7 日</time><span>周六</span></h2>
  <ol><li>
    <div><span class="mono block …">18:01</span>
      <span><span class="size-1.5 …"></span>更新</span></div>
    <article><h3>…title…</h3><p>…body…</p></article>
  </li></ol>
</section>
```

- The **date comes from `id="d-…"`**, not the rendered Chinese text — reformatting a localized
  date is a parsing problem with no upside.
- The **kind** ("更新" / "优化" / "公告" / "下线") is the readable text of the meta column with the
  clock stripped. The decorative dot is a nested `<span>` placed *before* the label inside the
  same span, so a per-span `>text<` read misses it — strip the column instead.
- Every value goes through `stripTags` + `decodeEntities`: this is third-party HTML being fed to
  a model.

## Update detection

- **git's own ref advertisement, not the REST API.**
  `https://github.com/<owner>/<repo>/info/refs?service=git-upload-pack` is what `git ls-remote`
  requests. The REST API allows 60 unauthenticated calls an hour **per IP, shared across every
  plugin on the machine**; a handful of GitHub-installed plugins exhaust it and the whole update
  list silently stops reporting (`dshmarket` records this as #349). This endpoint has no such
  budget.
- **`commit` stays bare 40-hex.** It is compared for equality against upstream, so a `-dirty`
  suffix would mark every locally-edited build as behind. The dirty flag travels in
  `BuildInfo.dirty` and is reported separately.
- **"Could not tell" is `null`, not `false`.** A tarball install has no `.git`; reporting it as
  up to date would put a green badge on the wrong answer.
- **Read-only, always.** The tool returns the ref and the command for the detected install shape
  and stops. Applying an update mutates a profile (`pnpm add`, or pull + rebuild + DSH restart)
  and does not belong inside a chat turn.

## The one-commit lag (known, by design)

A bundle can only record the HEAD that existed **when it was built**, and a commit is by
definition created *after* the files it contains. So the artifact committed in revision `N`
usually names revision `N-1`:

```
commit A  (code + rebuilt index.js naming A)     <- artifact names its parent
commit B  (the artifact commit itself)           <- upstream head is now B
```

The tool reports that honestly as `updateAvailable: true` with the two revisions named. It does
**not** claim to be current, and it does not invent a verdict it cannot support.

This is a false *alarm*, never a false *all-clear*, which is the safe direction: an unnecessary
`git pull --ff-only` is a no-op, while a missed update is invisible. Do not "fix" it by committing
the rebuilt artifact again — the new commit recreates the same gap one revision later (that loop
was tried and reverted). Two real options if the noise matters:

- **Build in CI on a clean tag**, so the published artifact always names a revision at or before
  the tag, and compare against that tag rather than the branch head.
- **Read `behindReason`** once it exists: comparing commit *timestamps* distinguishes "built
  before its own commit" from "genuinely behind", at the cost of one more GitHub call.

What is genuinely fixed is the dangerous direction: `dev/build.mjs` refuses a dirty tree, so a
shipped `commit` always names a revision that **contains** the code it runs. Before that guard, a
build made mid-edit could name a revision that never contained the change at all.

## `__SOOYO_BUILD__`

`dev/build.mjs` inlines `{ version, commit, dirty, builtAt }` via esbuild `define`, because the
build is the only moment `package.json` **and** `.git` are both readable: an installed package
ships only `files`, and a `github:` install has no checkout. `src/host/build-info.ts` guards the
reference with `typeof` so a direct `node` run (no define) does not throw.

`installShape()` decides `checkout` vs `package` by looking for `.git` beside the entry — a
`stat`, not a network call.

## Context Bridge budget

The bridge appends at most two lines, and only when there is something to say:

- the newest changelog entry (plus a pointer to `sooyo_aihot`), and
- an update notice **only** when this build is behind, carries local edits, or the check failed.

Being current produces no line. The bridge reads the last successful parse — it never fetches —
so a third party can never hold a turn open. `describeChangelog` is bounded by `limit`, and the
changelog is trimmed to a 14-day window before the line is built.

Runs on **every** role. The changelog is the same for everyone, and the build compared against
upstream is *this* Host's own copy — which is the right answer on a `client` too, because each
machine installs the plugin separately (Desktop runs a checkout, the Tencent Hub runs a
`github:` install, and they can legitimately differ). `sooyo_update_check` reports its `role`
and, on a client, a `scope` line saying the Hub's copy may differ. Only the feed pump above it
is Hub-only.

## Configuration

All optional, under the row's `config.upstream`:

| Key | Default | Meaning |
|---|---|---|
| `repo` | `CaiZongyuan/dsh-sooyo` | Upstream repository to compare against |
| `ref` | `main` | Branch to compare against |
| `changelogTtlMinutes` | `15` | Changelog cache TTL |
| `guideTtlHours` | `6` | Agent-guide cache TTL |
| `checkTtlMinutes` | `60` | Update-check cache TTL |
| `context` | `true` | Set `false` to keep both lines out of the Context Bridge |

## Testing

`dev/selftest.mjs` carries offline fixtures for both parsers (changelog HTML, ref advertisement)
plus assertions that a failed check never reads as "up to date", that a blank extra produces no
blank line, and that the bridge renders extras **before** its two footer lines. Extend those
fixtures rather than testing against the live site — the suite runs with `--offline` in CI.
