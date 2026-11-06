# Client UI, Layout & CSS Rules

Reference for `client.js`, `personal.js`, and visual verification of the Sooyo panel.

## Widget Type vs. Size (`ADR 0001`)

- **The Widget Type selects the renderer; the Widget's Size selects the information level.** A Source does not own a card ([`docs/adr/0001-widget-decoupled-from-source.md`](./adr/0001-widget-decoupled-from-source.md)): it may `suggests.pres` for a new 订阅 Widget, and layout is user data.
- `R.<type>` in `client.js` branches on the Size (`S`, `M`, `L`, `Wide`) and returns a different level of detail per Size — never a stretched copy, and never a size the type does not declare.
- Unknown Widget Types or Sizes from a newer schema version must be preserved round-trip in storage and rendered via a read-only placeholder card rather than coerced to `'task'` or overwritten.

## Bento Packing & Card Body Budget (`ov=0`)

- **Sooyo uses a discrete footprint packer (`pack()` + `footprint()`), not a free-form 2D coordinate grid.** `layouts` stores `{ cols, order: [{ id, size }] }`, and the packer computes placement across `12 / 8 / 4` column breakpoints.
- **No card may clip its content.** A card scrolls deliberately or not at all. Card body height is `n * ROW + (n - 1) * GAP - CHROME`; if a renderer outgrows that budget, fix the budget or the renderer — never let a row be cut in half.
- `fitDom()` drops whole children from a `.sy-fit` container until `scrollHeight <= clientHeight`, which is how every non-scrolling card maintains `ov=0`.
- **Type size is a layout input.** `ROW` / `GAP` and each renderer's item count are budgeted against the type ramp; bumping font sizes without re-measuring pushes a card over its body height. After any type or density change, re-assert `ov=0`.
- **A cover needs `width: 100%`.** Without it, a cover inside a row-flex parent collapses to its content width (producing a narrow vertical strip in the hero).
- **A breakpoint without a saved layout is derived, not written.** `layoutOf()` copies the 12-column order on first read so a phone layout starts as a copy; writing it back eagerly would let two layouts diverge without the user touching either.

## Icons & Assets

- **Icons come from the bundle.** The Client renders `<img src="/sooyo/assets/a/<type>.webp">` and the Host serves that path out of `assets/`, so a new Widget Type needs its icon added there and listed in `package.json` `files`.
- The route only accepts a flat `<style>/<name>.webp` shape; do not widen it. See [`docs/agents/image-generation.md`](./agents/image-generation.md) for generation rules.

## CSS Isolation & Container Queries

- **The Host skin can reach into the panel, and only `!important` + targeted resets stop it.** Installed UI skins (e.g. `dsh-claude-style`) set tag-level colours with `!important` on `a`, `code`, and headings. Resets in `client.js` therefore use `color: inherit !important` on `.sy-root :where(a, a:visited, a:hover)` and `.sy-root :where(code, kbd, samp, pre)`.
- **Never use the `font` shorthand in a reset.** It overrides each component's own `font-size`/`font-weight` and flattens headings to body size. Reset `font-family` only. Keep the `client.css guards` block in `dev/selftest.mjs` green.
- **No backticks inside the `CSS` template literal.** `CSS` in `client.js` is a template literal; a backtick inside a CSS comment terminates it early and breaks the whole module with a `SyntaxError`. The offline self-test asserts none are present.
- **Container queries add no specificity — placement is their only lever.** Every narrow-screen `@container sy` override must live in one block at the end of `CSS`, after every base rule; `dev/selftest.mjs` asserts that ordering.
- **A container cannot style its own container.** `.sy-page` wraps the `sy` container, so `@container sy { .sy-page { … } }` never matches. Use a `@media` query for any box that sizes the container, and `@container sy` only for descendants.
- **A sticky bar over scrolling content must be translucent, not opaque.** Frost it (`backdrop-filter` + a tint) with a `@supports not` fallback so browsers without the filter still hide scrolled text, and watch its height on narrow viewports.

## Visual & Layout Verification

- `pnpm run test:e2e` (`tests/e2e/ui.spec.mjs`, see [`docs/testing.md`](./testing.md)) installs the packaged plugin into a real isolated DSH Web Host and drives Playwright across Desktop (`1440×900`) and Mobile (`390×844`) in light and dark themes, asserting `ov=0`, interactive Proposal Approve/Rollback, unknown Widget placeholders, and pruned Read Later snapshots.
- `dev/measure-mobile.mjs` extracts the real CSS from `client.js` and measures layout at 390×844 over CDP. When driving the live UI in a browser:

- **Do not use `wait --load networkidle`** — DSH holds a WebSocket open, so the network never goes idle.
- `eval` runs in one shared global scope; wrap scripts in an IIFE and prefer `eval -b <base64>` over `--stdin` to avoid shell mangling.
- Assert `ov=0` programmatically across all breakpoints (`12 / 8 / 4` cols) and both themes (`light` / `dark`):

```js
(() => Array.from(document.querySelectorAll('.sy-grid > .sy-w')).map(el => {
  const body = el.querySelector('.sy-w-b')
  return (el.querySelector('.sy-w-t b') || {}).textContent + ' ov=' +
    (body ? body.scrollHeight - body.clientHeight : 'n/a')
}))()
```
