/**
 * Client half of sooyo daily — generated from `src/client/index.ts`.
 * Do not edit by hand; run `pnpm run build` to regenerate.
 */
window.__ModuleLoader__.load({
  id: 'dsh-sooyo',
  factory(require) {
    const exports = {}
    const module = { exports }
    const CSS = `
.sy-root {
  --sy-bg: #F3F4F6; --sy-card: #FFFFFF; --sy-well: #F5F6F8;
  --sy-line: rgba(20,22,30,.07); --sy-line2: rgba(20,22,30,.13);
  --sy-ink: #15171C; --sy-ink2: #5A5F69; --sy-ink3: #9CA1AB;
  --sy-accent: #6A6FCF; --sy-accent-soft: rgba(106,111,207,.10); --sy-accent-ink: #4A4FAE;
  --sy-bad: #CC4C42; --sy-ok: #3A9A68; --sy-on-photo: #FFFFFF;
  --sy-skel: rgba(20,22,30,.06); --sy-scrim: rgba(14,15,18,.34);
  --sy-shadow: 0 1px 2px rgba(16,18,24,.04), 0 10px 28px -16px rgba(16,18,24,.14);
  --sy-shadow-hover: 0 2px 4px rgba(16,18,24,.05), 0 16px 36px -16px rgba(16,18,24,.20);
  --sy-shadow-lift: 0 4px 10px rgba(16,18,24,.08), 0 28px 56px -18px rgba(16,18,24,.30);
  --sy-t-task: #6F74D3; --sy-t-subscription: #D98A4C; --sy-t-capture: #9A86CC;
  --sy-t-bookmarks: #4A9895; --sy-t-project: #66966B; --sy-t-readlater: #CC9632;
  --sy-t-habit: #D27690; --sy-t-focus: #C3654A; --sy-t-calendar: #E05A46;
  --sy-t-weather: #5E9FD3; --sy-t-briefing: #B8963A; --sy-t-embed: #6C7C93;
  --sy-t-agentInbox: #7C6FD4; --sy-t-notes: #7A8BD6;
  /* Frosted chrome. The sticky bar must let content show through, or a headline scrolling under
     it is sliced in half — which is exactly what a phone reported. The blur alone is not enough:
     a translucent tint plus a hairline keeps the bar readable over a photo card, and the inset
     highlight is what gives it the frosted-glass edge rather than a flat wash. */
  --sy-chrome: rgba(243,244,246,.72); --sy-chrome-line: rgba(20,22,30,.06);
  --sy-chrome-lift: inset 0 1px 0 rgba(255,255,255,.65);
  --sy-blur: saturate(180%) blur(20px);
  --sy-font: -apple-system, BlinkMacSystemFont, "SF Pro Text", "PingFang SC", "HarmonyOS Sans SC", "Microsoft YaHei", "Segoe UI", sans-serif;
  --sy-mono: ui-monospace, "SF Mono", "JetBrains Mono", Menlo, Consolas, monospace;
  --sy-row: 88px; --sy-gap: 14px; --sy-radius: 16px;
  height: 100%; overflow: auto; background: var(--sy-bg); color: var(--sy-ink);
  font: 14px/1.45 var(--sy-font); -webkit-font-smoothing: antialiased;
}
/* Dark theme.
 *
 * The palette is warm-neutral rather than blue-black: a #121211 ground with #181816 surfaces.
 * A pure #0E0F12 reads as a screen; a slightly warm black reads as a surface, which is what
 * makes the frosted chrome on top of it look like glass instead of a lighter rectangle. The
 * values are deliberately close together — the separation comes from the hairline and the inset
 * highlight, not from a big luminance jump, which is what keeps a dense grid calm.
 */
.sy-root[data-theme="dark"] {
  --sy-bg: #121211; --sy-card: #181816; --sy-well: #201F1D;
  --sy-line: rgba(239,237,231,.07); --sy-line2: rgba(239,237,231,.14);
  --sy-ink: #EFEDE7; --sy-ink2: #D3D0C8; --sy-ink3: #8B8880;
  --sy-accent: #9CA4FF; --sy-accent-soft: rgba(156,164,255,.14); --sy-accent-ink: #BCC1FF;
  --sy-bad: #F2766A; --sy-ok: #88C49C; --sy-skel: rgba(239,237,231,.06); --sy-scrim: rgba(0,0,0,.62);
  /* Inset top highlight first: on a dark surface the 1px "lit edge" is what sells the material. */
  --sy-shadow: inset 0 1px 0 rgba(239,237,231,.035), 0 1px 2px rgba(0,0,0,.4), 0 12px 30px -18px rgba(0,0,0,.75);
  --sy-shadow-hover: inset 0 1px 0 rgba(239,237,231,.05), 0 2px 6px rgba(0,0,0,.45), 0 18px 38px -18px rgba(0,0,0,.85);
  --sy-shadow-lift: inset 0 1px 0 rgba(239,237,231,.06), 0 8px 20px rgba(0,0,0,.5), 0 32px 60px -20px rgba(0,0,0,.9);
  /* Chrome sits *over* content, so it is a tinted veil, not a solid fill. */
  --sy-chrome: rgba(18,18,17,.72); --sy-chrome-line: rgba(239,237,231,.08);
  --sy-chrome-lift: inset 0 1px 0 rgba(239,237,231,.05);
  color-scheme: dark;
}
/* Grain.
 *
 * A flat dark fill shows banding on OLED phones and looks synthetic next to photos. One inline
 * SVG turbulence at a few percent breaks it up and costs a single cached paint — no texture
 * file, no request. Blend mode overlay keeps it from washing out the ink beneath.
 *
 * It rides on a dedicated child element rather than ::after: the panel already uses ::after on
 * .sy-root for nothing else today, but a pseudo-element is one rule away from a collision, and
 * a real node can be toggled and inspected. A fixed position with inset zero covers the viewport
 * without changing layout, and pointer-events none keeps every click on the card beneath.
 */
.sy-grain {
  position: fixed; inset: 0; z-index: 60; pointer-events: none; opacity: .03;
  mix-blend-mode: overlay;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23g)'/%3E%3C/svg%3E");
}
.sy-root[data-theme="dark"] .sy-grain { opacity: .05; }
.sy-root *, .sy-root *::before, .sy-root *::after { box-sizing: border-box; }
/* Element resets.
 *
 * Two separate hazards, and they pull in opposite directions:
 *
 * 1. SPECIFICITY. A plain ".sy-root button { border: 0 }" is (0,1,1) and outranks every
 *    single-class component rule — ".sy-btn" is only (0,1,0) — which silently stripped the
 *    border and padding off every button in the panel. So the resets go through :where(),
 *    which contributes nothing.
 *
 * 2. INHERITED COLOUR FROM THE HOST SKIN. Zero specificity is not enough for the color
 *    property here: an installed UI skin sets tag-level colours (!important on anchor and
 *    code elements), so a reset that loses paints every link in salmon and every code span
 *    in orange — which is exactly what happened. The revert keyword plus !important is the
 *    only combination that wins against a !important author rule of any specificity, and
 *    revert keeps the browser default (currentColor for a link, monospace for code) instead
 *    of hard-coding a colour. Do not weaken these two declarations; verify with
 *    getComputedStyle after any change.
 */
.sy-root :where(button) { font: inherit; color: inherit; background: none; border: 0; padding: 0; cursor: pointer; }
.sy-root :where(input, textarea) { font: inherit; color: inherit; }
.sy-root :where(a) { color: inherit !important; text-decoration: none !important; }
.sy-root :where(code, kbd, samp) { color: inherit !important; font-family: var(--sy-mono) !important; }
/* Headings are the skin's most visible fingerprint: it swaps in a serif display face and a
   second type ramp. Reset the FACE only, never the shorthand: a "font" shorthand here (or
   font: inherit) also overrides every component's own font-size and font-weight, which
   silently flattened the panel's 40px headline to 14px/400. */
.sy-root :where(h1, h2, h3, h4, h5, h6) { font-family: var(--sy-font) !important; color: inherit !important; margin: 0; }
.sy-root :focus-visible { outline: 2px solid var(--sy-accent); outline-offset: 2px; border-radius: 8px; }
.sy-root svg { display: block; flex: none; }
.sy-root .c1, .sy-root .c2, .sy-root .c3, .sy-root .c4, .sy-root .c8 { display: -webkit-box; -webkit-box-orient: vertical; overflow: hidden; }
.sy-root .c1 { -webkit-line-clamp: 1; } .sy-root .c2 { -webkit-line-clamp: 2; }
.sy-root .c3 { -webkit-line-clamp: 3; } .sy-root .c4 { -webkit-line-clamp: 4; }
.sy-root .c8 { -webkit-line-clamp: 8; }
.sy-root .grow { flex: 1; min-width: 0; }
.sy-root .meta { font-size: 12px; color: var(--sy-ink3); font-variant-numeric: tabular-nums; white-space: nowrap; }
.sy-root .mono-l { font: 500 11px/1 var(--sy-mono); letter-spacing: .04em; color: var(--sy-ink3); flex: none; white-space: nowrap; }
.sy-page { padding: 0 20px 72px; }
.sy-frame { max-width: 1440px; margin: 0 auto; container: sy / inline-size; }
.sy-main { min-width: 0; }
/* The sticky bar.
 *
 * It used to paint an opaque background. On a phone the bar wraps to four rows and stands 156px
 * tall, so a headline scrolling under it was cut through the middle of its glyphs and the panel
 * looked broken. Three changes fix that and make it feel like glass:
 *
 *  1. a translucent tint plus a backdrop filter, so content shows through blurred instead of
 *     being sliced by an opaque rectangle;
 *  2. a hairline instead of a shadow, because a shadow under a wrapped bar reads as a second
 *     card edge on a small screen;
 *  3. a blurred veil rather than a solid fill, so the bar stays legible over a photo card.
 *
 * The webkit-prefixed property is listed for Safari and iOS, which is where a phone browser
 * usually is.
 */
.sy-topbar {
  position: sticky; top: 0; z-index: 20;
  display: flex; align-items: center; gap: 14px;
  padding-block: 12px;
  background: var(--sy-chrome);
  -webkit-backdrop-filter: var(--sy-blur); backdrop-filter: var(--sy-blur);
  box-shadow: var(--sy-chrome-lift), 0 1px 0 var(--sy-chrome-line);
}
/* A fallback for a browser that ignores backdrop-filter: the tint must still hide scrolled text,
   or the bug this block exists for comes back. The supports-not query keeps it to exactly those. */
@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .sy-topbar { background: var(--sy-bg); }
}
.sy-brand { display: flex; align-items: center; gap: 8px; font-weight: 650; font-size: 17px; letter-spacing: -.02em; white-space: nowrap; }
.sy-brand > svg { width: 26px; height: 26px; display: block; flex: none; }
.sy-brand span { color: var(--sy-ink3); font-weight: 500; }
.sy-seg { display: flex; padding: 3px; background: var(--sy-well); border: 1px solid var(--sy-line); border-radius: 12px; gap: 2px; min-width: 0; overflow-x: auto; scrollbar-width: none; }
.sy-seg::-webkit-scrollbar { display: none; }
.sy-seg button { padding: 6px 12px; border-radius: 9px; color: var(--sy-ink2); font-weight: 500; white-space: nowrap; }
.sy-seg button:hover { color: var(--sy-ink); }
.sy-seg button[aria-pressed="true"] { background: var(--sy-card); color: var(--sy-ink); box-shadow: 0 1px 2px rgba(16,18,24,.08), 0 0 0 1px var(--sy-line); }
.sy-seg .sy-seg-add { color: var(--sy-ink3); padding: 6px 9px; }
.sy-cmd { position: relative; flex: 1; min-width: 0; max-width: 520px; margin-inline: auto; }
.sy-cmd-box { display: flex; align-items: center; gap: 8px; height: 38px; padding: 0 5px 0 12px; background: var(--sy-card); border: 1px solid var(--sy-line); border-radius: 12px; box-shadow: var(--sy-shadow); color: var(--sy-ink3); }
.sy-cmd-box:focus-within { border-color: color-mix(in srgb, var(--sy-accent) 45%, transparent); }
.sy-cmd-box input { flex: 1; min-width: 0; border: 0; outline: 0; background: transparent; color: var(--sy-ink); }
.sy-root kbd { font: 500 11px/1 var(--sy-mono); color: var(--sy-ink3); border: 1px solid var(--sy-line2); border-radius: 6px; padding: 3px 6px; white-space: nowrap; }
.sy-cmd-pop { position: absolute; top: calc(100% + 6px); left: 0; right: 0; z-index: 40; background: var(--sy-card); border: 1px solid var(--sy-line); border-radius: 14px; box-shadow: var(--sy-shadow-lift); padding: 6px; max-height: min(420px, 60vh); overflow: auto; }
.sy-cmd-group { font: 500 11px/1 var(--sy-mono); letter-spacing: .06em; text-transform: uppercase; color: var(--sy-ink3); padding: 10px 10px 6px; }
.sy-cmd-item { display: flex; align-items: center; gap: 10px; width: 100%; padding: 8px 10px; border-radius: 9px; text-align: left; min-width: 0; }
.sy-cmd-item[aria-selected="true"] { background: var(--sy-accent-soft); }
.sy-cmd-item .k { font: 500 11px/1 var(--sy-mono); color: var(--sy-ink2); background: var(--sy-well); border-radius: 6px; padding: 4px 6px; flex: none; }
.sy-cmd-item .ci-t { flex: 1; min-width: 0; }
.sy-cmd-empty { padding: 14px 10px; color: var(--sy-ink3); font-size: 13px; }
.sy-actions { display: flex; align-items: center; gap: 8px; margin-left: auto; }
.sy-btn { height: 34px; padding: 0 13px; border-radius: 11px; border: 1px solid var(--sy-line2); background: var(--sy-card); font-weight: 500; display: inline-flex; align-items: center; justify-content: center; gap: 6px; white-space: nowrap; }
.sy-btn:hover { border-color: var(--sy-ink3); }
.sy-btn:disabled { opacity: .4; cursor: not-allowed; }
.sy-btn-ink { background: var(--sy-ink); color: var(--sy-bg); border-color: var(--sy-ink); }
.sy-btn-wide { height: 48px; border-radius: 14px; font-size: 15px; color: var(--sy-ink3); width: 100%; }
.sy-btn-wide b { color: var(--sy-ink); font-weight: 500; }
.sy-icon-btn { width: 34px; height: 34px; border-radius: 11px; display: grid; place-items: center; border: 1px solid var(--sy-line2); background: var(--sy-card); color: var(--sy-ink2); flex: none; }
.sy-icon-btn:hover { color: var(--sy-ink); border-color: var(--sy-ink3); }
.sy-switch { display: inline-flex; align-items: center; gap: 8px; height: 34px; padding: 0 4px 0 10px; border-radius: 11px; font-weight: 500; color: var(--sy-ink2); white-space: nowrap; }
.sy-switch:hover { color: var(--sy-ink); }
.sy-sw { width: 44px; height: 26px; border-radius: 99px; background: var(--sy-well); border: 1px solid var(--sy-line2); position: relative; transition: background .25s; }
.sy-sw::after { content: ""; position: absolute; top: 2px; left: 2px; width: 20px; height: 20px; border-radius: 50%; background: var(--sy-card); box-shadow: 0 2px 6px rgba(16,18,24,.22); transition: transform .25s cubic-bezier(.3,.7,.2,1); }
.sy-switch[aria-checked="true"] { color: var(--sy-ink); }
.sy-switch[aria-checked="true"] .sy-sw { background: linear-gradient(90deg, #93A8F0, #C9A6EE); border-color: transparent; }
.sy-switch[aria-checked="true"] .sy-sw::after { transform: translateX(18px); background: #FFFFFF; }
@container sy (max-width: 1080px) {
  .sy-topbar { flex-wrap: wrap; row-gap: 10px; }
  .sy-cmd { order: 5; flex-basis: 100%; max-width: none; }
}
/* Phone.
 *
 * The bar used to become four stacked rows (brand + actions / command / boards), 156px tall on a
 * 390px screen — 18% of the viewport spent on chrome, and enough to swallow the headline when it
 * scrolled. This keeps it to two rows by putting the board strip on the *same* row as the brand,
 * scrolling horizontally when it does not fit. That is how a mobile tab bar behaves, and it is
 * what the strip's own overflow rule was already built for.
 *
 * The brand drops its word mark and the command box drops its shortcut hint: both are affordances
 * a touch screen does not have, so removing them buys the row the strip needs.
 *
 * Placement matters: this block sits AFTER the base rules it overrides. A container query does not
 * add specificity, so a phone rule written above its base rule loses on source order — which is
 * exactly how the first attempt produced a 20px headline that still measured 24px.
 */
.sy-hero { display: flex; align-items: flex-end; justify-content: space-between; gap: 24px; padding-block: 26px 22px; }
.sy-tag { display: inline-block; font: 500 11px/1 var(--sy-mono); letter-spacing: .06em; border: 1px solid var(--sy-ink2); color: var(--sy-ink); border-radius: 5px; padding: 4px 6px; margin-bottom: 16px; }
.sy-headline { margin: 0; font-size: clamp(24px, 3cqi, 40px); line-height: 1.2; letter-spacing: -.028em; font-weight: 500; color: var(--sy-ink3); max-width: 23em; text-wrap: balance; }
.sy-headline b { color: var(--sy-ink); font-weight: 500; }
.sy-hi { display: inline-block; width: 1.18em; height: 1.18em; vertical-align: -.24em; margin: 0 .04em 0 .02em; filter: drop-shadow(0 6px 10px rgba(16,18,24,.16)); transform: rotate(-7deg); }
.sy-hi.r { transform: rotate(6deg); }
.sy-nw { white-space: nowrap; }
.sy-status { display: flex; align-items: center; gap: 8px; font: 12px var(--sy-mono); color: var(--sy-ink2); white-space: nowrap; padding-bottom: 6px; }
.sy-status i { width: 7px; height: 7px; border-radius: 50%; background: var(--sy-ok); box-shadow: 0 0 0 3px color-mix(in srgb, var(--sy-ok) 18%, transparent); }
.sy-status i.warn { background: var(--sy-bad); box-shadow: 0 0 0 3px color-mix(in srgb, var(--sy-bad) 18%, transparent); }
@container sy (max-width: 720px) {
  .sy-hero { flex-direction: column; align-items: flex-start; gap: 12px; padding-block: 16px; }
  .sy-headline { font-size: 24px; }
}
.sy-editbar { display: flex; align-items: center; gap: 10px; padding: 9px 9px 9px 13px; border-radius: 14px; background: var(--sy-accent-soft); color: var(--sy-accent-ink); margin-bottom: 14px; font-size: 13px; }
.sy-grid { display: grid; grid-template-columns: repeat(var(--cols, 12), minmax(0, 1fr)); grid-auto-rows: var(--sy-row); gap: var(--sy-gap); position: relative; }
@container sy (max-width: 640px) { .sy-grid { --sy-gap: 12px; } }
.sy-w { position: relative; display: flex; flex-direction: column; min-width: 0; background: var(--sy-card); border: 1px solid var(--sy-line); border-radius: var(--sy-radius); box-shadow: var(--sy-shadow); padding: 15px; overflow: hidden; transition: box-shadow .2s ease; }
.sy-w:hover { box-shadow: var(--sy-shadow-hover); }
.sy-w-h { display: flex; align-items: center; gap: 8px; height: 24px; margin-bottom: 9px; flex: none; min-width: 0; }
.sy-w-t { flex: 1; min-width: 0; display: flex; align-items: baseline; gap: 8px; white-space: nowrap; overflow: hidden; }
.sy-w-t b { font-size: 14px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; }
.sy-w-t span { font-size: 12px; color: var(--sy-ink3); overflow: hidden; text-overflow: ellipsis; }
.sy-w-m { width: 24px; height: 24px; border-radius: 8px; display: grid; place-items: center; color: var(--sy-ink3); opacity: 0; transition: opacity .15s; flex: none; }
.sy-w:hover .sy-w-m, .sy-w:focus-within .sy-w-m { opacity: 1; }
.sy-w-m:hover { background: var(--sy-well); color: var(--sy-ink); }
.sy-w-m.abs { position: absolute; top: 10px; right: 10px; z-index: 3; }
@media (hover: none) { .sy-w-m { opacity: .7; } }
.sy-w-b { flex: 1; min-height: 0; display: flex; flex-direction: column; gap: 9px; position: relative; z-index: 1; }
.sy-w--s .sy-w-b { gap: 0; justify-content: space-between; }
.sy-ic { display: inline-grid; place-items: center; width: var(--s, 22px); height: var(--s, 22px); border-radius: 28%; background: transparent; flex: none; }
.sy-ic img { width: 100%; height: 100%; object-fit: contain; }
.sy-ic[data-fallback] { background: color-mix(in srgb, var(--ic-c, var(--sy-accent)) 22%, var(--sy-card)); }
.sy-deco { position: absolute; inset: 0; overflow: hidden; pointer-events: none; border-radius: inherit; z-index: 0; }
.sy-deco img { position: absolute; right: -16px; bottom: -20px; width: 112px; height: 112px; transform: rotate(-8deg); filter: drop-shadow(0 10px 18px rgba(16,18,24,.16)); }
.sy-s-lab { font-size: 12px; font-weight: 500; color: var(--sy-ink2); display: flex; align-items: center; gap: 6px; padding-right: 26px; white-space: nowrap; overflow: hidden; }
.sy-s-main { display: flex; flex-direction: column; }
.sy-s-big { font-size: 48px; font-weight: 300; line-height: 1; letter-spacing: -.045em; font-variant-numeric: tabular-nums; }
.sy-s-big small { font-size: 20px; color: var(--sy-ink3); letter-spacing: 0; margin-left: 3px; font-weight: 400; }
.sy-s-sub { font-size: 13px; color: var(--sy-ink2); margin-top: 5px; }
.sy-s-narrow { max-width: 64%; }
.sy-s-next { display: flex; align-items: center; gap: 8px; max-width: 70%; text-align: left; font-size: 13px; color: var(--sy-ink2); }
.sy-s-title { font-size: 16px; font-weight: 600; line-height: 1.32; letter-spacing: -.01em; }
.sy-list { display: flex; flex-direction: column; min-height: 0; overflow: hidden; }
.sy-fit { flex: 1; min-height: 0; overflow: hidden; }
.sy-fit-x { display: flex; gap: 12px; overflow: hidden; flex: 1; min-height: 0; }
.sy-row { position: relative; display: flex; align-items: center; gap: 10px; min-height: 34px; padding: 4px 8px; margin-inline: -8px; border-radius: 10px; min-width: 0; flex: none; }
.sy-row:hover { background: var(--sy-well); }
.sy-row .tt { font-size: 13.5px; font-weight: 500; }
.sy-it-a { display: flex; flex-direction: column; gap: 1px; min-width: 0; flex: 1; }
.sy-chk { width: 18px; height: 18px; border-radius: 50%; border: 1.5px solid var(--sy-ink3); display: grid; place-items: center; flex: none; color: transparent; transition: background .15s, border-color .15s; }
.sy-chk:hover { border-color: var(--sy-accent); }
.sy-done .sy-chk { background: var(--sy-accent); border-color: var(--sy-accent); color: var(--sy-card); }
.sy-done .tt, .sy-done .t-title { color: var(--sy-ink3); text-decoration: line-through; text-decoration-color: color-mix(in srgb, var(--sy-ink3) 60%, transparent); }
.sy-t-title { font-size: 13.5px; }
.sy-t-m { min-height: 50px; align-items: flex-start; padding-top: 8px; }
.sy-t-m .sy-chk { margin-top: 1px; }
.sy-chip { display: inline-flex; align-items: center; gap: 4px; height: 20px; padding: 0 7px; border-radius: 99px; background: var(--sy-well); color: var(--sy-ink2); font-size: 11px; white-space: nowrap; flex: none; max-width: 40%; overflow: hidden; text-overflow: ellipsis; }
.sy-root a.sy-chip:hover { color: var(--sy-accent-ink); background: var(--sy-accent-soft); }
.sy-acts { position: absolute; right: 6px; top: 50%; transform: translateY(-50%); display: none; gap: 4px; z-index: 2; }
.sy-row:hover .sy-acts, .sy-row:focus-within .sy-acts, .sy-lead:hover .sy-acts, .sy-ncard:hover .sy-acts { display: flex; }
.sy-acts button, .sy-acts a { width: 26px; height: 26px; display: grid; place-items: center; border-radius: 8px; background: var(--sy-card); border: 1px solid var(--sy-line2); color: var(--sy-ink2); box-shadow: var(--sy-shadow); }
.sy-acts button:hover, .sy-acts a:hover { color: var(--sy-accent-ink); }
.sy-acts [aria-pressed="true"] { color: var(--sy-accent-ink); background: var(--sy-accent-soft); }
.sy-mini { height: 24px; padding: 0 8px; border-radius: 7px; font-size: 12px; color: var(--sy-ink2); background: var(--sy-card); border: 1px solid var(--sy-line2); flex: none; white-space: nowrap; }
.sy-mini:hover { color: var(--sy-accent-ink); border-color: color-mix(in srgb, var(--sy-accent) 40%, transparent); }
.sy-bar { height: 6px; border-radius: 3px; background: var(--sy-well); overflow: hidden; flex: none; }
.sy-bar i { display: block; height: 100%; border-radius: 3px; background: var(--c, var(--sy-accent)); transition: width .4s ease; }
.sy-grid2 { display: grid; grid-template-columns: 1fr 1fr; column-gap: 18px; row-gap: 4px; min-height: 0; flex: 1; align-content: start; overflow: hidden; }
.sy-grid2.r3 { grid-template-rows: repeat(3, auto); grid-auto-flow: column; row-gap: 0; }
.sy-rk-n { width: 22px; font-size: 18px; font-weight: 300; color: var(--sy-ink3); font-variant-numeric: tabular-nums; text-align: right; flex: none; letter-spacing: -.03em; }
.sy-rk-n.top { color: var(--sy-ink); }
.sy-rk-row { min-height: 30px; }
.sy-rk-row .tt { font-weight: 450; }
.sy-thumb { border-radius: 9px; overflow: hidden; background: var(--sy-well); flex: none; position: relative; }
.sy-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
.sy-gen { display: grid; place-items: center; width: 100%; height: 100%; background: linear-gradient(140deg, color-mix(in srgb, var(--c) 30%, var(--sy-card)), color-mix(in srgb, var(--c) 8%, var(--sy-card))); color: color-mix(in srgb, var(--c) 75%, var(--sy-ink)); font: 600 12px/1.2 var(--sy-font); text-align: center; padding: 6px; }
.sy-mono-t { width: 34px; height: 34px; border-radius: 10px; display: grid; place-items: center; font-weight: 650; font-size: 14px; background: color-mix(in srgb, var(--c) 16%, var(--sy-card)); color: color-mix(in srgb, var(--c) 80%, var(--sy-ink)); flex: none; }
.sy-m-split { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.25fr); gap: 18px; flex: 1; min-height: 0; }
.sy-lead { position: relative; display: flex; flex-direction: column; gap: 6px; min-width: 0; min-height: 0; flex: none; }
.sy-lead .sy-acts { top: 6px; right: 6px; transform: none; }
.sy-lead-t { font-size: 15px; font-weight: 600; line-height: 1.35; letter-spacing: -.01em; }
.sy-lead-t.lg { font-size: 17px; }
.sy-reason { font-size: 13px; color: var(--sy-ink2); line-height: 1.5; }
.sy-reason::before { content: "推荐理由"; font: 500 10.5px/1 var(--sy-mono); letter-spacing: .04em; color: var(--sy-ink3); border: 1px solid var(--sy-line2); border-radius: 4px; padding: 2px 4px; margin-right: 6px; vertical-align: 1px; }
.sy-tldr { font-size: 12.5px; line-height: 1.5; color: var(--sy-ink2); background: var(--sy-well); border-radius: 10px; padding: 6px 9px; flex: none; }
.sy-w--photo { padding: 0; border-color: transparent; }
.sy-w--photo .bgimg { position: absolute; inset: 0; z-index: 0; }
.sy-w--photo .bgimg img { width: 100%; height: 100%; object-fit: cover; }
.sy-w--photo .bgimg::after { content: ""; position: absolute; inset: 0; background: linear-gradient(to top, rgba(10,12,16,.82), rgba(10,12,16,.12) 62%, rgba(10,12,16,.3)); }
.sy-w--photo .sy-w-b { padding: 13px 15px; color: var(--sy-on-photo); justify-content: space-between; }
.sy-w--photo .sy-s-lab { color: rgba(255,255,255,.86); }
.sy-w--photo .meta { color: rgba(255,255,255,.7); }
.sy-w--photo .sy-w-m { color: rgba(255,255,255,.85); }
.sy-w--photo .sy-w-m:hover { background: rgba(255,255,255,.16); color: #FFFFFF; }
.sy-w--photo .sy-acts { top: auto; bottom: 10px; right: 10px; transform: none; }
.sy-w--photo:hover .sy-acts { display: flex; }
.sy-cover { height: 124px; border-radius: 12px; overflow: hidden; background: var(--sy-well); flex: none; position: relative; }
.sy-cover img { width: 100%; height: 100%; object-fit: cover; }
.sy-nl-top { display: flex; align-items: center; gap: 6px; min-width: 0; overflow: hidden; flex: none; }
.sy-nl { flex-direction: row; gap: 14px; align-items: flex-start; }
.sy-nl-cover { flex: 0 0 172px; aspect-ratio: 16 / 9; border-radius: 10px; overflow: hidden; background: var(--sy-well); max-width: 40%; }
.sy-nl-cover img { width: 100%; height: 100%; object-fit: cover; }
.sy-nl-t, .sy-pl-t { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 6px; }
.sy-cat { font-size: 11px; line-height: 1; font-weight: 500; color: color-mix(in srgb, var(--c) 78%, var(--sy-ink)); background: color-mix(in srgb, var(--c) 14%, var(--sy-card)); border-radius: 5px; padding: 4px 6px; flex: none; }
.sy-cdot { width: 6px; height: 6px; border-radius: 50%; background: var(--c); flex: none; align-self: flex-start; margin-top: 8px; }
.sy-score { display: inline-grid; place-items: center; min-width: 26px; height: 20px; padding: 0 6px; border-radius: 6px; font-size: 12px; font-weight: 650; font-variant-numeric: tabular-nums; background: var(--sy-well); color: var(--sy-ink2); flex: none; }
.sy-score.hi { background: var(--sy-ink); color: var(--sy-bg); }
.sy-sc { font-size: 12px; font-weight: 600; color: var(--sy-ink3); font-variant-numeric: tabular-nums; min-width: 20px; text-align: right; flex: none; }
.sy-seen .tt, .sy-seen .sy-lead-t { color: var(--sy-ink3); font-weight: 450; }
.sy-tabs { display: flex; gap: 2px; flex: none; overflow-x: auto; scrollbar-width: none; }
.sy-tabs::-webkit-scrollbar { display: none; }
.sy-tabs button { height: 26px; padding: 0 9px; border-radius: 8px; font-size: 12.5px; color: var(--sy-ink2); white-space: nowrap; display: inline-flex; align-items: center; gap: 5px; }
.sy-tabs button span { font-size: 11px; color: var(--sy-ink3); font-variant-numeric: tabular-nums; }
.sy-tabs button:hover { background: var(--sy-well); }
.sy-tabs button[aria-pressed="true"] { background: var(--sy-ink); color: var(--sy-bg); }
.sy-tabs button[aria-pressed="true"] span { color: color-mix(in srgb, var(--sy-bg) 65%, transparent); }
.sy-heat { width: 42px; height: 4px; border-radius: 2px; background: var(--sy-well); flex: none; overflow: hidden; }
.sy-heat i { display: block; height: 100%; border-radius: 2px; background: linear-gradient(90deg, color-mix(in srgb, var(--sy-t-subscription) 45%, var(--sy-card)), var(--sy-t-subscription)); }
.sy-heat.wide { width: 60px; }
.sy-up { display: inline-flex; align-items: center; gap: 4px; height: 22px; padding: 0 7px; border-radius: 7px; font-size: 12px; font-weight: 650; font-variant-numeric: tabular-nums; background: color-mix(in srgb, var(--sy-t-readlater) 17%, var(--sy-card)); color: color-mix(in srgb, var(--sy-t-readlater) 70%, var(--sy-ink)); flex: none; }
.sy-up.big { height: auto; padding: 0; background: none; font-size: 30px; font-weight: 300; letter-spacing: -.03em; gap: 6px; color: var(--sy-ink); align-self: flex-start; }
.sy-kws { display: flex; flex-wrap: wrap; gap: 4px; height: 20px; overflow: hidden; flex: none; }
.sy-kws .sy-chip { max-width: none; }
.sy-chip.match { background: var(--sy-accent-soft); color: var(--sy-accent-ink); gap: 3px; }
.sy-links { display: flex; flex-wrap: wrap; gap: 4px 14px; font-size: 12.5px; flex: none; }
.sy-links a { color: var(--sy-ink2); display: inline-flex; align-items: center; gap: 4px; }
.sy-links a:hover { color: var(--sy-accent-ink); }
.sy-links code { font-family: var(--sy-mono); font-size: 11.5px; color: var(--sy-ink3); }
.sy-pl { flex-direction: row; gap: 14px; }
.sy-pl-fig { flex: 0 0 156px; height: 104px; border-radius: 10px; overflow: hidden; background: #FFFFFF; border: 1px solid var(--sy-line); }
.sy-pl-fig img { width: 100%; height: 100%; object-fit: contain; }
.sy-pr .sy-rk-n { font-size: 14px; }
.sy-ncard { position: relative; flex: 0 0 260px; display: flex; flex-direction: column; gap: 6px; padding: 11px 13px; border-radius: 12px; background: var(--sy-well); min-width: 0; }
.sy-fit-x > .sy-ncard { flex: 1 0 240px; }
.sy-ncard .sy-chip:not(.match) { background: var(--sy-card); }
.sy-ncard .foot { margin-top: auto; }
.sy-ncard .sy-acts { top: 6px; right: 6px; transform: none; }
.sy-reason-plain { font-size: 12.5px; line-height: 1.5; color: var(--sy-ink2); }
.sy-vt { position: relative; display: block; border-radius: 10px; overflow: hidden; background: var(--sy-well); flex: none; }
.sy-vt img, .sy-ep img, .sy-s916 img { width: 100%; height: 100%; object-fit: cover; transition: transform .4s ease; display: block; }
.sy-vt:hover img, .sy-ep:hover img, .sy-s916:hover img { transform: scale(1.045); }
.sy-vplay { position: absolute; left: 50%; top: 50%; width: 38px; height: 38px; margin: -19px 0 0 -19px; border-radius: 50%; background: rgba(255,255,255,.92); color: #15171C; display: grid; place-items: center; box-shadow: 0 6px 18px rgba(0,0,0,.28); transition: transform .2s ease; z-index: 1; }
.sy-vplay svg { margin-left: 2px; }
.sy-vt:hover .sy-vplay, .sy-ep:hover .sy-vplay { transform: scale(1.1); }
.sy-vbadge { position: absolute; left: 8px; bottom: 8px; font-size: 11px; font-weight: 600; color: #FFFFFF; background: rgba(10,12,16,.62); padding: 3px 6px; border-radius: 6px; z-index: 1; }
.sy-vm { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 14px; flex: 1; min-height: 0; }
.sy-vm .sy-vt { height: 100%; aspect-ratio: 16 / 9; }
.sy-vm-t { display: flex; flex-direction: column; gap: 6px; min-width: 0; justify-content: center; }
.sy-vL { display: grid; grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr); gap: 14px; flex: 1; min-height: 0; }
.sy-vL-ep { display: flex; flex-direction: column; gap: 9px; min-width: 0; min-height: 0; }
.sy-vL-ep .sy-vt { aspect-ratio: 16 / 9; width: 100%; }
.sy-vL-sh { display: flex; flex-direction: column; min-width: 0; min-height: 0; }
.sy-reel2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; align-content: start; }
.sy-reel2 .sy-s916 { height: auto; width: 100%; }
.sy-reel { gap: 8px; }
.sy-s916, .sy-ep { position: relative; flex: 0 0 auto; height: 100%; border-radius: 10px; overflow: hidden; background: var(--sy-well); display: block; }
.sy-s916 { aspect-ratio: 9 / 16; }
.sy-ep { aspect-ratio: 16 / 9; border-radius: 12px; }
.sy-s916::after, .sy-ep::after { content: ""; position: absolute; inset: 35% 0 0; background: linear-gradient(to top, rgba(10,12,16,.9), rgba(10,12,16,.55) 45%, transparent); }
.sy-s916 > span { position: absolute; left: 7px; right: 7px; bottom: 7px; z-index: 1; color: #FFFFFF; font-size: 11.5px; line-height: 1.3; }
.sy-s916 em { font-style: normal; font-weight: 500; }
.sy-s916 b { display: block; font-weight: 600; font-size: 10.5px; opacity: .8; margin-top: 3px; }
.sy-ep-t { position: absolute; left: 13px; right: 13px; bottom: 11px; z-index: 1; color: #FFFFFF; display: flex; flex-direction: column; gap: 4px; font-size: 12px; }
.sy-ep-t b { font-size: 15px; font-weight: 600; line-height: 1.35; }
.sy-ep-t .mono-l { color: rgba(255,255,255,.75); }
.sy-ep-t > span:last-child { color: rgba(255,255,255,.78); }
.sy-cap { display: flex; align-items: center; gap: 8px; height: 42px; padding: 0 8px 0 13px; border-radius: 12px; background: var(--sy-well); border: 1px solid var(--sy-line); flex: none; }
.sy-cap:focus-within { border-color: color-mix(in srgb, var(--sy-accent) 45%, transparent); background: var(--sy-card); }
.sy-cap input { flex: 1; min-width: 0; border: 0; outline: 0; background: transparent; font-size: 15px; }
.sy-cap input::placeholder { color: var(--sy-ink3); }
.sy-cap-wide { display: grid; grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr); gap: 18px; flex: 1; min-height: 0; align-items: start; }
.sy-cap-hint { font-size: 12px; color: var(--sy-ink3); flex: none; }
.sy-cap-hint code { font-family: var(--sy-mono); color: var(--sy-ink2); background: var(--sy-well); border-radius: 4px; padding: 1px 4px; }
.sy-kind { font: 500 10.5px/1 var(--sy-mono); padding: 3px 5px; border-radius: 4px; flex: none; text-transform: uppercase; letter-spacing: .03em; }
.sy-kind.task { background: color-mix(in srgb, var(--sy-t-task) 15%, var(--sy-card)); color: color-mix(in srgb, var(--sy-t-task) 80%, var(--sy-ink)); }
.sy-kind.note { background: color-mix(in srgb, var(--sy-t-capture) 15%, var(--sy-card)); color: color-mix(in srgb, var(--sy-t-capture) 80%, var(--sy-ink)); }
.sy-bm-s { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px 6px; align-content: center; flex: 1; }
.sy-bm-tile { display: flex; flex-direction: column; align-items: center; gap: 5px; min-width: 0; border-radius: 12px; padding: 2px 0; }
.sy-bm-tile .sy-mono-t { width: 42px; height: 42px; border-radius: 13px; font-size: 17px; }
.sy-bm-tile span { font-size: 11.5px; color: var(--sy-ink2); max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sy-bm-grid { display: grid; gap: 8px 12px; flex: 1; align-content: start; }
.sy-bm-chip { display: flex; align-items: center; gap: 9px; min-width: 0; padding: 4px; border-radius: 10px; }
.sy-bm-chip:hover { background: var(--sy-well); }
.sy-bm-chip .sy-mono-t { width: 30px; height: 30px; border-radius: 9px; font-size: 13px; }
.sy-bm-chip span { font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sy-ring { position: relative; flex: none; }
.sy-ring b { position: absolute; inset: 0; display: grid; place-items: center; font-size: 14px; font-weight: 600; font-variant-numeric: tabular-nums; }
.sy-pj-s { display: flex; align-items: center; gap: 13px; min-width: 0; }
.sy-pj-row { display: flex; flex-direction: column; gap: 6px; flex: none; padding: 2px 0; }
.sy-pj-row .sy-pj-h { display: flex; align-items: center; gap: 8px; min-width: 0; }
.sy-pj-row .sy-pj-h b { font-size: 13.5px; font-weight: 600; }
.sy-pj-dot { width: 8px; height: 8px; border-radius: 3px; background: var(--c); flex: none; }
.sy-dots7 { display: flex; gap: 5px; flex: none; }
.sy-dots7 button, .sy-dots7 span { width: 18px; height: 18px; border-radius: 6px; background: var(--sy-well); border: 1px solid var(--sy-line); display: grid; place-items: center; font-size: 9.5px; color: var(--sy-ink3); }
.sy-dots7 .on { background: color-mix(in srgb, var(--sy-t-habit) 78%, var(--sy-card)); border-color: transparent; color: #FFFFFF; }
.sy-dots7 .future { opacity: .45; background: transparent; border-style: dashed; }
.sy-dots7 .today { border: 1.5px dashed color-mix(in srgb, var(--sy-t-habit) 70%, transparent); }
.sy-dots7 .today.on { border: 0; }
.sy-hb-row { display: flex; align-items: center; gap: 12px; min-width: 0; flex: none; min-height: 32px; }
.sy-fd { font-size: 42px; font-weight: 300; letter-spacing: -.04em; font-variant-numeric: tabular-nums; line-height: 1; }
.sy-fx { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.sy-play-btn { width: 38px; height: 38px; border-radius: 50%; background: var(--sy-ink); color: var(--sy-bg); display: grid; place-items: center; flex: none; box-shadow: var(--sy-shadow); }
.sy-play-btn.ghost { background: var(--sy-well); color: var(--sy-ink2); box-shadow: none; }
.sy-fm { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 18px; align-items: center; flex: 1; min-height: 0; }
.sy-fm .sy-ring b { font-size: 18px; font-weight: 400; letter-spacing: -.02em; }
.sy-sess { display: flex; gap: 4px; }
.sy-sess i { width: 18px; height: 6px; border-radius: 3px; background: var(--sy-well); }
.sy-sess i.on { background: var(--sy-t-focus); }
.sy-deck { display: flex; flex-direction: column; flex: 1; min-height: 0; outline: none; }
.sy-dk-stage { position: relative; flex: 1; min-height: 0; }
.sy-dk-card { position: absolute; inset: 0 0 10px; border-radius: 14px; overflow: hidden; background: var(--sy-card); border: 1px solid var(--sy-line2); box-shadow: 0 1px 2px rgba(16,18,24,.05), 0 14px 26px -18px rgba(16,18,24,.35); transition: transform .55s cubic-bezier(.2,.85,.25,1), opacity .35s ease; transform-origin: 50% 100%; opacity: 0; user-select: none; touch-action: pan-y; cursor: grab; }
.sy-dk-card[data-pos="cur"] { z-index: 3; opacity: 1; }
.sy-dk-card[data-pos="n1"] { z-index: 2; opacity: 1; transform: translateY(7px) scale(.955); }
.sy-dk-card[data-pos="n2"] { z-index: 1; opacity: .55; transform: translateY(13px) scale(.91); }
.sy-dk-card[data-pos="hide"] { transform: translateY(13px) scale(.9); }
.sy-dk-card[data-pos="past"] { transform: translateX(-118%) rotate(-12deg); }
.sy-dk-card:not([data-pos="cur"]) { pointer-events: none; }
.sy-dk-card:not([data-pos="cur"]) .sy-dk-in { filter: saturate(.6); }
.sy-deck.dragging .sy-dk-card[data-pos="cur"] { transition: none; cursor: grabbing; }
.sy-deck.no-anim .sy-dk-card { transition: none !important; }
.sy-dk-in { position: relative; z-index: 1; height: 100%; display: flex; flex-direction: column; justify-content: space-between; gap: 9px; padding: 15px 17px; }
.sy-w--m .sy-dk-in { padding: 10px 13px; gap: 6px; }
.sy-dk-in.center { align-items: center; justify-content: center; text-align: center; gap: 8px; }
.sy-dk-in.center img { width: 76px; height: 76px; }
.sy-dk-in.center b { font-size: 15px; }
.sy-dk-top { display: flex; align-items: center; gap: 6px; min-width: 0; flex: none; }
.sy-dk-src { font: 600 11px/1 var(--sy-mono); letter-spacing: .04em; color: var(--sy-ink2); text-transform: uppercase; white-space: nowrap; }
.sy-dk-time { font-size: 12px; color: var(--sy-ink3); white-space: nowrap; }
.sy-dk-main { display: flex; flex-direction: column; gap: 7px; min-height: 0; }
.sy-dk-title { font-size: 17px; font-weight: 650; line-height: 1.32; letter-spacing: -.015em; }
.sy-dk-title.lg { font-size: 20px; }
.sy-w--m .sy-dk-title { font-size: 15px; }
.sy-dk-sum { margin: 0; font-size: 13px; line-height: 1.55; color: var(--sy-ink2); }
.sy-dk-sum.tl { background: color-mix(in srgb, var(--sy-card) 70%, transparent); border: 1px solid var(--sy-line); border-radius: 10px; padding: 7px 9px; }
.sy-w--m .sy-dk-sum.tl { border: 0; padding: 0; background: none; font-size: 12.5px; }
.sy-dk-meta { font-size: 12px; color: var(--sy-ink3); }
.sy-dk-hint { display: inline-flex; align-items: center; gap: 5px; font-size: 12px; color: var(--sy-ink3); }
.sy-dk-art { position: absolute; inset: 0; background: radial-gradient(110% 90% at 100% 0%, color-mix(in srgb, var(--c, var(--sy-accent)) 24%, transparent), transparent 62%), radial-gradient(90% 80% at 0% 100%, color-mix(in srgb, var(--sy-accent) 10%, transparent), transparent 70%), var(--sy-card); }
.sy-dk-art.paper { --c: var(--sy-t-readlater); }
.sy-dk-big { position: absolute; right: 12px; top: -6px; z-index: 0; font-size: 116px; font-weight: 200; line-height: 1; letter-spacing: -.07em; color: color-mix(in srgb, var(--c, var(--sy-t-readlater)) 20%, transparent); pointer-events: none; }
.sy-w--m .sy-dk-big { font-size: 78px; }
.sy-dk-bg { position: absolute; inset: 0; }
.sy-dk-bg img { width: 100%; height: 100%; object-fit: cover; }
.sy-dk-bg::after { content: ""; position: absolute; inset: 0; background: linear-gradient(to top, rgba(10,12,16,.9), rgba(10,12,16,.45) 55%, rgba(10,12,16,.2)); }
.sy-on-photo .sy-dk-in, .sy-on-photo .sy-dk-title, .sy-on-photo .sy-dk-src { color: #FFFFFF; }
.sy-on-photo .sy-dk-sum, .sy-on-photo .sy-dk-meta, .sy-on-photo .sy-dk-time { color: rgba(255,255,255,.78); }
.sy-on-photo .sy-chip.match { background: rgba(255,255,255,.18); color: #FFFFFF; }
.sy-dk-card[data-pos="cur"] .sy-dk-main > * { animation: sy-dkin .55s cubic-bezier(.2,.8,.2,1) both; }
.sy-dk-card[data-pos="cur"] .sy-dk-main > :nth-child(2) { animation-delay: .06s; }
.sy-dk-card[data-pos="cur"] .sy-dk-main > :nth-child(3) { animation-delay: .12s; }
@keyframes sy-dkin { from { opacity: 0; transform: translateY(10px); } }
.sy-ctl { display: flex; align-items: center; gap: 8px; flex: none; margin-top: 6px; min-width: 0; }
.sy-nav { width: 26px; height: 26px; border-radius: 9px; border: 1px solid var(--sy-line2); font-size: 17px; line-height: 1; color: var(--sy-ink2); display: grid; place-items: center; flex: none; }
.sy-nav:hover { color: var(--sy-ink); border-color: var(--sy-ink3); }
.sy-dots { display: flex; align-items: center; gap: 4px; flex: none; }
.sy-dots i { width: 6px; height: 6px; border-radius: 3px; background: var(--sy-line2); transition: width .35s cubic-bezier(.2,.8,.2,1), background .3s; }
.sy-dots i.done { background: color-mix(in srgb, var(--sy-accent) 45%, transparent); }
.sy-dots i.on { width: 18px; background: var(--sy-accent); }
.sy-tip { font-size: 12px; color: var(--sy-ink3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; }
.sy-dk-b { display: inline-flex; align-items: center; gap: 5px; height: 28px; padding: 0 10px; border-radius: 9px; border: 1px solid var(--sy-line2); font-size: 12.5px; font-weight: 500; color: var(--sy-ink2); white-space: nowrap; flex: none; }
.sy-dk-b:hover { color: var(--sy-ink); border-color: var(--sy-ink3); }
.sy-dk-b.pri { background: var(--sy-ink); color: var(--sy-bg); border-color: var(--sy-ink); }
.sy-dk-arrow { position: absolute; top: calc(50% - 20px); z-index: 6; width: 26px; height: 26px; border-radius: 50%; background: var(--sy-card); border: 1px solid var(--sy-line2); box-shadow: var(--sy-shadow); font-size: 16px; line-height: 1; color: var(--sy-ink2); display: grid; place-items: center; opacity: 0; transition: opacity .2s; }
.sy-dk-arrow.l { left: -6px; } .sy-dk-arrow.r { right: -6px; }
.sy-w:hover .sy-dk-arrow { opacity: 1; }
.sy-deck.v .sy-dk-stage { overflow: hidden; }
.sy-deck.v .sy-dk-card { inset: 0; border: 0; border-radius: 0; background: transparent; box-shadow: none; cursor: pointer; }
.sy-deck.v .sy-dk-card[data-pos="n1"], .sy-deck.v .sy-dk-card[data-pos="n2"], .sy-deck.v .sy-dk-card[data-pos="hide"] { opacity: 0; transform: translateY(70%); }
.sy-deck.v .sy-dk-card[data-pos="past"] { opacity: 0; transform: translateY(-70%); }
.sy-deck.v .sy-dk-in { padding: 0; gap: 6px; justify-content: flex-start; }
.sy-segs { display: flex; gap: 4px; flex: none; margin-bottom: 8px; }
.sy-segs i { flex: 1; height: 3px; border-radius: 2px; background: var(--sy-well); overflow: hidden; position: relative; }
.sy-segs i::after { content: ""; position: absolute; inset: 0; background: var(--sy-ink); transform-origin: left; transform: scaleX(0); }
.sy-segs i.done::after { transform: scaleX(1); opacity: .35; }
.sy-segs:not(.auto) i.run::after { transform: scaleX(1); }
.sy-segs.auto i.run::after { animation: sy-seg 5s linear forwards; }
.sy-deck:hover .sy-segs i.run::after, .sy-deck:focus-within .sy-segs i.run::after { animation-play-state: paused; }
@keyframes sy-seg { to { transform: scaleX(1); } }
.sy-hot-l { display: flex; align-items: baseline; gap: 8px; }
.sy-hot-n { font-size: 32px; font-weight: 300; line-height: 1; letter-spacing: -.04em; font-variant-numeric: tabular-nums; }
.sy-hot .sy-dk-title { font-size: 15px; font-weight: 600; }
.sy-hot-m { display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--sy-ink3); margin-top: auto; white-space: nowrap; }
/* 论文 cards flip: the 3D container is the only place a transform is allowed to carry
   meaning, and the back face keeps the full abstract so the front can stay short. */
.sy-dk-card.paper { perspective: 1400px; background: transparent; border: 0; box-shadow: none; overflow: visible; }
.sy-flip { position: absolute; inset: 0; transform-style: preserve-3d; transition: transform .7s cubic-bezier(.3,.7,.2,1); }
.sy-dk-card.flipped .sy-flip { transform: rotateY(180deg); }
.sy-dk-card.paper .face { position: absolute; inset: 0; border-radius: 14px; overflow: hidden; backface-visibility: hidden; -webkit-backface-visibility: hidden; background: var(--sy-card); border: 1px solid var(--sy-line2); box-shadow: 0 1px 2px rgba(16,18,24,.05), 0 14px 26px -18px rgba(16,18,24,.35); }
.sy-dk-card.paper .face.back { transform: rotateY(180deg); background: var(--sy-well); }
.sy-dk-card.paper .face.back .sy-dk-in { justify-content: flex-start; }
.sy-dk-card.paper .face.back .sy-links { margin-top: auto; padding-top: 10px; border-top: 1px solid var(--sy-line2); }
.sy-dk-abs { margin: 0; font-size: 12.5px; line-height: 1.58; color: var(--sy-ink); }
.sy-agenda-h { font: 500 11px/1 var(--sy-mono); letter-spacing: .05em; color: var(--sy-ink3); padding: 8px 0 4px; flex: none; }
.sy-w-deck { display: flex; flex-direction: column; }
.sy-vL { display: grid; grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr); gap: 14px; flex: 1; min-height: 0; }
.sy-vL-ep { display: flex; flex-direction: column; gap: 9px; min-width: 0; min-height: 0; }
.sy-vL-ep .sy-vt { aspect-ratio: 16 / 9; width: 100%; }
.sy-vL-sh { display: flex; flex-direction: column; min-width: 0; min-height: 0; }
@container sy (max-width: 640px) { .sy-tip, .sy-dots { display: none; } }
.sy-sk { background: var(--sy-skel); border-radius: 8px; position: relative; overflow: hidden; flex: none; }
.sy-sk::after { content: ""; position: absolute; inset: 0; transform: translateX(-100%); background: linear-gradient(90deg, transparent, color-mix(in srgb, var(--sy-card) 70%, transparent), transparent); animation: sy-shimmer 1.3s infinite; }
@keyframes sy-shimmer { to { transform: translateX(100%); } }
.sy-state { display: flex; flex-direction: column; align-items: flex-start; justify-content: center; gap: 8px; flex: 1; min-height: 0; }
.sy-state p { margin: 0; font-size: 13.5px; color: var(--sy-ink2); max-width: 30em; }
.sy-state.err p { color: var(--sy-ink); }
.sy-state .err-i { color: var(--sy-bad); }
.sy-state-ill { display: flex; align-items: center; gap: 14px; flex: 1; min-height: 0; }
.sy-state-ill img { width: 76px; height: 76px; flex: none; }
.sy-soon { display: grid; place-items: center; flex: 1; border: 1.5px dashed var(--sy-line2); border-radius: 12px; color: var(--sy-ink3); font-size: 13px; text-align: center; padding: 12px; }
.sy-editing .sy-w { cursor: grab; outline: 1.5px dashed color-mix(in srgb, var(--sy-accent) 55%, transparent); outline-offset: -1px; }
.sy-editing .sy-w-b, .sy-editing .sy-deco { pointer-events: none; opacity: .55; }
.sy-editing .sy-w-m { display: none; }
.sy-e-bar { position: absolute; top: 6px; right: 6px; z-index: 5; display: none; gap: 3px; padding: 3px; background: var(--sy-card); border: 1px solid var(--sy-line2); border-radius: 10px; box-shadow: var(--sy-shadow-hover); color: var(--sy-ink); }
.sy-editing .sy-e-bar { display: flex; }
.sy-e-bar button { min-width: 24px; height: 22px; padding: 0 5px; border-radius: 7px; font: 500 11.5px/1 var(--sy-mono); color: var(--sy-ink2); display: grid; place-items: center; }
.sy-e-bar button:hover { background: var(--sy-well); color: var(--sy-ink); }
.sy-e-bar button[aria-pressed="true"] { background: var(--sy-ink); color: var(--sy-bg); }
.sy-e-bar .sep { width: 1px; background: var(--sy-line2); margin: 3px 2px; }
.sy-e-bar .del:hover { color: var(--sy-bad); }
.sy-e-rz { position: absolute; right: 3px; bottom: 3px; width: 22px; height: 22px; z-index: 5; display: none; place-items: center; cursor: nwse-resize; color: var(--sy-accent-ink); border-radius: 7px; background: var(--sy-card); box-shadow: var(--sy-shadow); touch-action: none; }
.sy-editing .sy-e-rz { display: grid; }
.sy-w.is-ph { background: color-mix(in srgb, var(--sy-accent) 6%, transparent); box-shadow: none; border: 1.5px dashed color-mix(in srgb, var(--sy-accent) 60%, transparent); outline: 0 !important; }
.sy-w.is-ph > * { visibility: hidden; }
.sy-ghost { position: fixed; z-index: 60; pointer-events: none; margin: 0; box-shadow: var(--sy-shadow-lift) !important; transform: rotate(1.2deg) scale(1.02); outline: 0 !important; }
.sy-ghost .sy-w-b { opacity: 1 !important; }
.sy-grid-empty { grid-column: 1 / -1; grid-row: span 4; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; border: 1.5px dashed var(--sy-line2); border-radius: var(--sy-radius); color: var(--sy-ink2); text-align: center; padding: 22px; }
.sy-grid-empty img { width: 88px; height: 88px; }
.sy-grid-empty .row-btns { display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; }
.sy-pop { position: fixed; z-index: 55; min-width: 210px; background: var(--sy-card); border: 1px solid var(--sy-line); border-radius: 13px; box-shadow: var(--sy-shadow-lift); padding: 6px; }
.sy-pop-h { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; padding: 6px 10px 4px; font-size: 12px; font-weight: 600; color: var(--sy-ink2); }
.sy-pop .sizes { display: flex; gap: 4px; padding: 4px 10px 8px; }
.sy-sz { min-width: 36px; height: 26px; padding: 0 6px; border-radius: 8px; border: 1px solid var(--sy-line2); font: 500 12px/1 var(--sy-mono); color: var(--sy-ink2); }
.sy-sz:hover:not([disabled]) { border-color: var(--sy-ink3); color: var(--sy-ink); }
.sy-sz[aria-pressed="true"] { background: var(--sy-ink); color: var(--sy-bg); border-color: var(--sy-ink); }
.sy-sz[disabled] { opacity: .3; cursor: not-allowed; }
.sy-pop hr { border: 0; height: 1px; background: var(--sy-line); margin: 4px 0; }
.sy-mi { display: flex; width: 100%; align-items: center; gap: 10px; padding: 8px 10px; border-radius: 8px; text-align: left; font-size: 13.5px; }
.sy-mi:hover { background: var(--sy-well); }
.sy-mi.danger { color: var(--sy-bad); }
.sy-mi input { flex: 1; min-width: 0; height: 30px; border-radius: 8px; border: 1px solid var(--sy-line2); background: var(--sy-well); padding: 0 10px; outline: 0; }
.sy-scrim { position: fixed; inset: 0; z-index: 70; background: var(--sy-scrim); display: grid; place-items: center; padding: 16px; animation: sy-fade .16s ease; }
@keyframes sy-fade { from { opacity: 0; } }
.sy-sheet { width: min(940px, 100%); max-height: min(720px, 100%); background: var(--sy-card); border: 1px solid var(--sy-line); border-radius: 22px; box-shadow: var(--sy-shadow-lift); display: flex; flex-direction: column; overflow: hidden; animation: sy-rise .22s cubic-bezier(.2,.8,.2,1); }
.sy-sheet.sm { width: min(500px, 100%); }
@keyframes sy-rise { from { transform: translateY(10px) scale(.985); opacity: 0; } }
.sy-sh-h { display: flex; align-items: center; gap: 12px; padding: 16px 18px 12px; border-bottom: 1px solid var(--sy-line); flex: none; }
.sy-sh-h h2 { margin: 0; font-size: 17px; font-weight: 600; letter-spacing: -.01em; flex: 1; min-width: 0; }
.sy-sh-b { padding: 16px 18px; overflow: auto; display: flex; flex-direction: column; gap: 14px; min-height: 0; }
.sy-sh-f { display: flex; justify-content: flex-end; gap: 8px; padding: 12px 18px; border-top: 1px solid var(--sy-line); flex: none; }
.sy-fld { display: flex; flex-direction: column; gap: 7px; }
.sy-fld > span { font-size: 12px; font-weight: 600; color: var(--sy-ink2); }
.sy-fld input[type="text"], .sy-fld textarea { height: 36px; border-radius: 10px; border: 1px solid var(--sy-line2); background: var(--sy-well); padding: 0 12px; outline: 0; }
.sy-fld textarea { height: auto; min-height: 74px; padding: 9px 12px; resize: vertical; line-height: 1.5; }
.sy-fld input:focus, .sy-fld textarea:focus { border-color: color-mix(in srgb, var(--sy-accent) 50%, transparent); }
.sy-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.sy-chipbtn { height: 28px; padding: 0 11px; border-radius: 99px; border: 1px solid var(--sy-line2); font-size: 13px; color: var(--sy-ink2); white-space: nowrap; }
.sy-chipbtn[aria-pressed="true"] { background: var(--sy-accent-soft); border-color: color-mix(in srgb, var(--sy-accent) 40%, transparent); color: var(--sy-accent-ink); }
.sy-seg.sm button { padding: 5px 10px; font-size: 13px; }
.sy-gal { display: grid; grid-template-columns: 280px minmax(0, 1fr); flex: 1; min-height: 0; }
.sy-gal-l { border-right: 1px solid var(--sy-line); overflow: auto; padding: 10px; display: flex; flex-direction: column; gap: 2px; }
.sy-gal-l h3 { margin: 10px 10px 6px; font: 500 11px/1 var(--sy-mono); letter-spacing: .06em; color: var(--sy-ink3); }
.sy-gal-it { display: flex; align-items: center; gap: 12px; padding: 8px 10px; border-radius: 12px; text-align: left; width: 100%; }
.sy-gal-it:hover { background: var(--sy-well); }
.sy-gal-it[aria-pressed="true"] { background: var(--sy-accent-soft); }
.sy-gal-it b { display: block; font-size: 14px; font-weight: 600; }
.sy-gal-it small { display: block; font-size: 12px; color: var(--sy-ink3); }
.sy-gal-it .soon-b { margin-left: auto; font: 500 10px/1 var(--sy-mono); color: var(--sy-ink3); border: 1px solid var(--sy-line2); border-radius: 4px; padding: 3px 4px; }
.sy-gal-r { overflow: auto; padding: 18px; display: flex; flex-direction: column; gap: 14px; min-width: 0; }
.sy-pv { background: var(--sy-bg); border-radius: 18px; height: 260px; overflow: hidden; flex: none; position: relative; }
.sy-pv-in { position: absolute; left: 50%; top: calc(50% - 8px); transform-origin: center; }
.sy-pv .sy-w { cursor: default; }
.sy-pv-cap { position: absolute; left: 14px; bottom: 10px; font: 11px var(--sy-mono); color: var(--sy-ink3); }
.sy-gal-meta { display: flex; flex-wrap: wrap; gap: 14px 26px; }
.sy-gal-acts { font-size: 12.5px; color: var(--sy-ink2); }
.sy-gal-acts b { color: var(--sy-ink); font-weight: 600; }
@media (max-width: 760px) {
  .sy-gal { grid-template-columns: 1fr; grid-template-rows: auto minmax(0, 1fr); }
  .sy-gal-l { flex-direction: row; overflow-x: auto; border-right: 0; border-bottom: 1px solid var(--sy-line); }
  .sy-gal-l h3 { display: none; }
  .sy-gal-it { flex: 0 0 auto; width: auto; }
  .sy-gal-it small, .sy-gal-it .soon-b { display: none; }
  .sy-pv { height: 220px; }
}
.sy-toast { position: fixed; left: 50%; bottom: 24px; transform: translateX(-50%); z-index: 80; background: var(--sy-ink); color: var(--sy-bg); border-radius: 12px; padding: 9px 12px 9px 15px; display: flex; align-items: center; gap: 12px; font-size: 13px; box-shadow: var(--sy-shadow-lift); max-width: calc(100vw - 32px); animation: sy-rise .2s ease; }
.sy-toast button { font-weight: 600; color: var(--sy-bg); text-decoration: underline; text-underline-offset: 3px; padding: 2px 4px; }
@media (prefers-reduced-motion: reduce) {
  .sy-root *, .sy-root *::before, .sy-root *::after { animation-duration: .01ms !important; animation-iteration-count: 1 !important; transition-duration: .01ms !important; }
}

/* ============================================================================
   App Navigation, Hero Capture, Stamps, Content Library, Schedule, and Retro
   ============================================================================ */
.sy-seg button[aria-selected="true"] { background: var(--sy-card); color: var(--sy-ink); box-shadow: 0 1px 2px rgba(16,18,24,.08), 0 0 0 1px var(--sy-line); }
.sy-app-nav button { display: inline-flex; align-items: center; gap: 5px; }
.sy-app-nav button small { font: 500 10.5px/1 var(--sy-mono); padding: 2px 5px; border-radius: 99px; background: var(--sy-accent-soft); color: var(--sy-accent-ink); }
.sy-hero { align-items: stretch; gap: 20px; }
.sy-hero-main { flex: 1 1 560px; min-width: 0; display: flex; flex-direction: column; gap: 12px; }
.sy-hero-top-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.sy-hero-top-row .sy-tag { margin-bottom: 0; }
.sy-hero-top-row .sy-status { padding-bottom: 0; }
.sy-hero-aside { flex: 0 1 420px; min-width: 0; display: flex; flex-direction: column; justify-content: flex-end; }
.sy-hero-capture { background: var(--sy-card); border: 1px solid var(--sy-line2); border-radius: 16px; padding: 10px 12px; box-shadow: var(--sy-shadow); display: flex; flex-direction: column; gap: 8px; margin-top: 2px; }
.sy-hero-capture-modes { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.sy-hero-mode-pill { font-size: 12px; font-weight: 500; padding: 3px 9px; border-radius: 99px; color: var(--sy-ink2); border: 1px solid transparent; }
.sy-hero-mode-pill:hover { color: var(--sy-ink); background: var(--sy-well); }
.sy-hero-mode-pill[aria-pressed="true"] { background: var(--sy-accent-soft); color: var(--sy-accent-ink); border-color: color-mix(in srgb, var(--sy-accent) 35%, transparent); }
.sy-hero-capture-row { display: flex; align-items: center; gap: 8px; min-width: 0; }
.sy-hero-capture-row input { flex: 1; min-width: 0; height: 34px; border-radius: 10px; border: 1px solid var(--sy-line); background: var(--sy-well); padding: 0 12px; outline: 0; }
.sy-hero-capture-row input:focus { border-color: color-mix(in srgb, var(--sy-accent) 50%, transparent); background: var(--sy-card); }
.sy-hero-related { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; padding-top: 2px; }
.sy-hero-related-chip { display: inline-flex; align-items: center; gap: 5px; max-width: 220px; padding: 3px 8px; border-radius: 8px; background: var(--sy-well); border: 1px solid var(--sy-line); font-size: 12px; color: var(--sy-ink2); }
.sy-hero-related-chip:hover { color: var(--sy-ink); border-color: var(--sy-line2); }

/* MiniStamps & Daily Stamp */
.sy-ministamps { background: var(--sy-card); border: 1px solid var(--sy-line); border-radius: 16px; padding: 12px 14px; box-shadow: var(--sy-shadow); display: flex; flex-direction: column; gap: 10px; min-width: 0; }
.sy-ministamps-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.sy-ministamps-title { font-size: 12px; font-weight: 600; color: var(--sy-ink2); }
.sy-ministamps-streak { font: 500 11px/1 var(--sy-mono); padding: 4px 8px; border-radius: 99px; background: var(--sy-accent-soft); color: var(--sy-accent-ink); }
.sy-ministamps-strip { display: grid; grid-template-columns: repeat(10, minmax(0, 1fr)); gap: 4px; align-items: end; }
.sy-ministamp-slot { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 4px 2px; border-radius: 10px; min-width: 0; }
.sy-ministamp-slot:hover { background: var(--sy-well); }
.sy-ministamp-slot.today { background: var(--sy-accent-soft); }
.sy-ministamp-day { font: 500 10px/1 var(--sy-mono); color: var(--sy-ink3); }
.sy-stamp { display: inline-block; filter: drop-shadow(0 3px 6px rgba(16,18,24,.14)); transition: transform .2s ease; }
.sy-ministamp-slot:hover .sy-stamp { transform: translateY(-2px) scale(1.06); }
.sy-stamp-empty { display: grid; place-items: center; }
.sy-stamp-empty i { width: 6px; height: 6px; border-radius: 50%; background: var(--sy-line2); display: block; }

/* Home Dockbar & Multimedia Wall */
.sy-home-dock { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: 14px; padding: 8px 12px; background: var(--sy-card); border: 1px solid var(--sy-line); border-radius: 14px; box-shadow: var(--sy-shadow); }
.sy-home-dock-left { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; min-width: 0; max-width: 100%; }
.sy-home-dock-filters { display: flex; align-items: center; gap: 6px; overflow-x: auto; max-width: 100%; scrollbar-width: none; }
.sy-home-dock-filters::-webkit-scrollbar { display: none; }
.sy-home-wall-section { margin-bottom: 20px; }
.sy-wall-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(268px, 1fr)); gap: 14px; }

/* Media Collection Card */
.sy-mcard { background: var(--sy-card); border: 1px solid var(--sy-line); border-radius: 16px; box-shadow: var(--sy-shadow); overflow: hidden; display: flex; flex-direction: column; cursor: pointer; transition: transform .18s ease, box-shadow .18s ease, border-color .18s ease; min-width: 0; }
.sy-mcard:hover { transform: translateY(-2px); box-shadow: var(--sy-shadow-hover); border-color: var(--sy-line2); }
.sy-mcard-thumb { position: relative; aspect-ratio: 16 / 9; background: var(--sy-well); overflow: hidden; flex: none; }
.sy-mcard-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
.sy-mcard-badge { position: absolute; top: 8px; left: 8px; padding: 3px 8px; border-radius: 99px; font-size: 11px; font-weight: 600; color: #FFFFFF; backdrop-filter: blur(8px); }
.sy-mcard-dur { position: absolute; right: 8px; bottom: 8px; padding: 2px 6px; border-radius: 6px; background: rgba(15,17,22,.78); color: #FFFFFF; font: 500 11px/1.2 var(--sy-mono); }
.sy-mcard-body { padding: 13px 14px; display: flex; flex-direction: column; gap: 8px; flex: 1; min-width: 0; }
.sy-mcard-meta { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; font-size: 11.5px; color: var(--sy-ink3); }
.sy-mcard-kind { display: inline-flex; align-items: center; gap: 4px; font-weight: 600; }
.sy-mcard-ext, .sy-mcard-pin { padding: 2px 6px; border-radius: 6px; background: var(--sy-accent-soft); color: var(--sy-accent-ink); font-size: 11px; font-weight: 500; }
.sy-mcard-title { font-size: 14.5px; font-weight: 600; line-height: 1.38; color: var(--sy-ink); margin: 0; }
.sy-mcard-sum { font-size: 12.5px; line-height: 1.5; color: var(--sy-ink2); margin: 0; }
.sy-mcard-tags { display: flex; flex-wrap: wrap; gap: 5px; }
.sy-mcard-tag { font: 500 11px/1.2 var(--sy-mono); padding: 3px 7px; border-radius: 6px; background: var(--sy-well); color: var(--sy-ink2); }
.sy-mcard-foot { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: auto; padding-top: 8px; border-top: 1px solid var(--sy-line); }
.sy-mcard-acts { display: flex; align-items: center; gap: 4px; }
.sy-mcard-acts button, .sy-mcard-acts a { font-size: 11.5px; padding: 3px 7px; border-radius: 7px; color: var(--sy-ink2); background: var(--sy-well); }
.sy-mcard-acts button:hover, .sy-mcard-acts a:hover { color: var(--sy-ink); background: var(--sy-line2); }

/* Shared Full-View Toolbar */
.sy-view-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; padding: 14px 0 12px; }
.sy-view-toolbar-left, .sy-view-toolbar-right { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; min-width: 0; }
.sy-view-search { height: 34px; border-radius: 10px; border: 1px solid var(--sy-line2); background: var(--sy-card); padding: 0 12px; min-width: 210px; outline: 0; }
.sy-view-search:focus { border-color: color-mix(in srgb, var(--sy-accent) 50%, transparent); }
.sy-view-empty { background: var(--sy-card); border: 1.5px dashed var(--sy-line2); border-radius: 18px; padding: 36px 20px; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 10px; color: var(--sy-ink2); }

/* Content View: Kanban & Table */
.sy-kanban-board { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; align-items: start; margin-top: 10px; }
.sy-kanban-board.cols-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.sy-kanban-col { background: var(--sy-well); border: 1px solid var(--sy-line); border-radius: 16px; padding: 12px; display: flex; flex-direction: column; gap: 10px; min-height: 360px; min-width: 0; }
.sy-kanban-col-h { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 2px 4px 6px; border-bottom: 1px solid var(--sy-line); }
.sy-kanban-col-h b { font-size: 13.5px; font-weight: 600; }
.sy-kanban-cards { display: flex; flex-direction: column; gap: 10px; min-height: 160px; }
.sy-kanban-empty { padding: 28px 12px; text-align: center; color: var(--sy-ink3); font-size: 12.5px; border: 1px dashed var(--sy-line2); border-radius: 12px; }
.sy-table-wrap { background: var(--sy-card); border: 1px solid var(--sy-line); border-radius: 16px; box-shadow: var(--sy-shadow); overflow-x: auto; margin-top: 10px; }
.sy-data-table { width: 100%; border-collapse: collapse; font-size: 13px; text-align: left; }
.sy-data-table th { padding: 11px 14px; font-size: 12px; font-weight: 600; color: var(--sy-ink2); border-bottom: 1px solid var(--sy-line2); background: var(--sy-well); white-space: nowrap; }
.sy-data-table td { padding: 10px 14px; border-bottom: 1px solid var(--sy-line); vertical-align: middle; }
.sy-data-table tr:last-child td { border-bottom: 0; }
.sy-data-table tr:hover td { background: var(--sy-well); cursor: pointer; }
.sy-table-title { display: flex; align-items: center; gap: 10px; min-width: 200px; max-width: 420px; }
.sy-table-thumb { width: 42px; height: 28px; object-fit: cover; border-radius: 6px; flex: none; }
.sy-table-acts { display: flex; align-items: center; gap: 6px; white-space: nowrap; }
.sy-table-acts button, .sy-table-acts a { padding: 4px 8px; border-radius: 7px; background: var(--sy-well); border: 1px solid var(--sy-line2); font-size: 12px; }
.sy-status-select { height: 28px; border-radius: 8px; border: 1px solid var(--sy-line2); background: var(--sy-card); color: var(--sy-ink); padding: 0 8px; font-size: 12px; }

/* Schedule View: Calendar & Focus/Inbox Rail */
.sy-schedule-layout { display: grid; grid-template-columns: minmax(0, 1fr) 340px; gap: 16px; align-items: start; margin-top: 6px; }
.sy-cal-tile { background: var(--sy-card); border: 1px solid var(--sy-line); border-radius: 18px; box-shadow: var(--sy-shadow); padding: 16px; display: flex; flex-direction: column; gap: 12px; min-width: 0; }
.sy-cal-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.sy-cal-title-group { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.sy-cal-title { font-size: 18px; font-weight: 600; margin: 0; }
.sy-cal-nav { display: flex; align-items: center; gap: 4px; }
.sy-cal-dow { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 6px; text-align: center; font: 500 11.5px/1 var(--sy-mono); color: var(--sy-ink3); padding: 4px 0; }
.sy-cal-grid { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 6px; }
.sy-cal-cell { min-height: 104px; background: var(--sy-well); border: 1px solid var(--sy-line); border-radius: 12px; padding: 7px 8px; display: flex; flex-direction: column; gap: 5px; cursor: pointer; min-width: 0; transition: border-color .15s ease, background .15s ease; }
.sy-cal-grid.week .sy-cal-cell { min-height: 220px; }
.sy-cal-cell.outside { opacity: .45; }
.sy-cal-cell.today { border-color: color-mix(in srgb, var(--sy-accent) 55%, transparent); background: color-mix(in srgb, var(--sy-accent) 5%, var(--sy-card)); }
.sy-cal-cell.selected { outline: 2px solid var(--sy-accent); outline-offset: -1px; background: var(--sy-card); }
.sy-cal-cell.drop-hover { background: var(--sy-accent-soft); border-color: var(--sy-accent); }
.sy-cal-cell-top { display: flex; align-items: center; justify-content: space-between; gap: 4px; min-height: 24px; }
.sy-cal-num { font: 600 12px/1 var(--sy-mono); color: var(--sy-ink2); }
.sy-cal-cell.today .sy-cal-num { color: var(--sy-accent-ink); }
.sy-cal-tasks { display: flex; flex-direction: column; gap: 4px; min-width: 0; flex: 1; }
.sy-cal-chip { display: flex; align-items: center; gap: 5px; padding: 3px 6px; border-radius: 7px; background: var(--sy-card); border: 1px solid var(--sy-line2); font-size: 11.5px; cursor: grab; min-width: 0; }
.sy-cal-chip.done { opacity: .55; text-decoration: line-through; }
.sy-cal-chip.prio-high { border-left: 3px solid var(--sy-bad); }
.sy-cal-chip.prio-medium { border-left: 3px solid var(--sy-accent); }
.sy-cal-chip-chk { width: 14px; height: 14px; border-radius: 4px; border: 1px solid var(--sy-line2); display: grid; place-items: center; font-size: 10px; flex: none; }
.sy-cal-chip-t { flex: 1; min-width: 0; }
.sy-cal-more { font: 500 10.5px/1 var(--sy-mono); color: var(--sy-ink3); padding-left: 4px; }
.sy-cal-add { display: flex; align-items: center; gap: 8px; padding-top: 8px; border-top: 1px solid var(--sy-line); }
.sy-cal-add input { flex: 1; min-width: 0; height: 34px; border-radius: 10px; border: 1px solid var(--sy-line2); background: var(--sy-well); padding: 0 12px; outline: 0; }

.sy-schedule-rail { display: flex; flex-direction: column; gap: 14px; min-width: 0; }
.sy-next-card, .sy-inbox-tray { background: var(--sy-card); border: 1px solid var(--sy-line); border-radius: 18px; box-shadow: var(--sy-shadow); padding: 15px 16px; display: flex; flex-direction: column; gap: 10px; min-width: 0; }
.sy-inbox-tray.drop-hover { border-color: var(--sy-accent); background: var(--sy-accent-soft); }
.sy-next-head, .sy-inbox-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.sy-next-eyebrow { font: 600 11px/1 var(--sy-mono); letter-spacing: .04em; color: var(--sy-accent-ink); }
.sy-next-title { font-size: 16px; font-weight: 600; margin: 0; line-height: 1.35; }
.sy-next-meta { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.sy-next-note { font-size: 12.5px; color: var(--sy-ink2); margin: 0; }
.sy-next-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.sy-next-empty { font-size: 13px; color: var(--sy-ink3); margin: 4px 0; }
.sy-next-list { display: flex; flex-direction: column; gap: 5px; padding-top: 8px; border-top: 1px solid var(--sy-line); }
.sy-next-row { display: flex; align-items: center; gap: 8px; padding: 4px 6px; border-radius: 8px; cursor: pointer; font-size: 12.5px; }
.sy-next-row:hover { background: var(--sy-well); }
.sy-next-row.done { opacity: .5; text-decoration: line-through; }

.sy-inbox-form { display: flex; gap: 6px; }
.sy-inbox-form input { flex: 1; min-width: 0; height: 32px; border-radius: 9px; border: 1px solid var(--sy-line2); background: var(--sy-well); padding: 0 10px; outline: 0; font-size: 12.5px; }
.sy-inbox-list { display: flex; flex-direction: column; gap: 6px; max-height: 360px; overflow-y: auto; }
.sy-inbox-empty { font-size: 12.5px; color: var(--sy-ink3); text-align: center; padding: 18px 8px; }
.sy-inbox-item { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 8px 10px; border-radius: 10px; background: var(--sy-well); border: 1px solid var(--sy-line); cursor: grab; }
.sy-inbox-item:hover { border-color: var(--sy-line2); }
.sy-inbox-item-main { display: flex; align-items: center; gap: 6px; min-width: 0; flex: 1; font-size: 13px; }
.sy-inbox-grip { color: var(--sy-ink3); font-family: var(--sy-mono); cursor: grab; }
.sy-inbox-acts { display: flex; align-items: center; gap: 4px; flex: none; }
.sy-inbox-acts button { font-size: 11px; padding: 3px 7px; border-radius: 6px; background: var(--sy-card); border: 1px solid var(--sy-line2); color: var(--sy-ink2); }
.sy-inbox-acts button:hover { color: var(--sy-ink); }
.sy-prio-dot { width: 7px; height: 7px; border-radius: 50%; flex: none; background: var(--sy-ink3); }
.sy-prio-dot.prio-high { background: var(--sy-bad); }
.sy-prio-dot.prio-medium { background: var(--sy-accent); }
.sy-prio-dot.prio-low { background: var(--sy-ok); }
.sy-subtask-list { display: flex; flex-direction: column; gap: 6px; }
.sy-subtask-row { display: flex; align-items: center; gap: 8px; padding: 6px 8px; border-radius: 8px; background: var(--sy-well); font-size: 13px; }

/* Retrospective View (5-Tile Bento) */
.sy-retro-grid { display: grid; grid-template-columns: repeat(12, minmax(0, 1fr)); gap: 14px; margin-top: 6px; }
.sy-retro-tile { background: var(--sy-card); border: 1px solid var(--sy-line); border-radius: 18px; box-shadow: var(--sy-shadow); padding: 18px 20px; display: flex; flex-direction: column; gap: 14px; min-width: 0; }
.sy-retro-hero { grid-column: span 8; justify-content: space-between; background: linear-gradient(145deg, color-mix(in srgb, var(--sy-accent) 7%, var(--sy-card)), var(--sy-card)); }
.sy-retro-trend { grid-column: span 4; }
.sy-retro-dist { grid-column: span 4; }
.sy-retro-reflect { grid-column: span 4; }
.sy-retro-advice { grid-column: span 4; }
.sy-retro-eyebrow { font: 600 11px/1 var(--sy-mono); letter-spacing: .06em; color: var(--sy-accent-ink); margin-bottom: 10px; }
.sy-retro-title { font-size: clamp(18px, 2cqi, 24px); font-weight: 500; line-height: 1.45; color: var(--sy-ink2); margin: 0; }
.sy-retro-title em { font-style: normal; color: var(--sy-accent-ink); font-weight: 600; }
.sy-retro-title b { color: var(--sy-ink); font-weight: 600; }
.sy-retro-metrics { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; padding-top: 14px; border-top: 1px solid var(--sy-line); }
.sy-retro-metric { display: flex; flex-direction: column; gap: 4px; }
.sy-retro-metric .num { font-size: 26px; font-weight: 600; line-height: 1.1; letter-spacing: -.03em; font-variant-numeric: tabular-nums; }
.sy-retro-metric .lbl { font-size: 12px; color: var(--sy-ink3); }
.sy-retro-tile-h { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; }
.sy-retro-tile-h h3 { font-size: 15px; font-weight: 600; margin: 0 0 2px; }
.sy-chart-wrap { display: flex; flex-direction: column; gap: 6px; flex: 1; justify-content: flex-end; }
.sy-chart-stat { display: flex; align-items: center; justify-content: space-between; font-size: 12px; color: var(--sy-ink2); }
.sy-chart { width: 100%; height: auto; overflow: visible; }
.sy-retro-mini-table { display: flex; flex-direction: column; gap: 6px; }
.sy-retro-mini-row { display: flex; align-items: center; justify-content: space-between; padding: 6px 8px; border-radius: 8px; background: var(--sy-well); font-size: 12.5px; }
.sy-dist-list { display: flex; flex-direction: column; gap: 8px; }
.sy-dist-subhead { font: 600 11px/1 var(--sy-mono); color: var(--sy-ink3); text-transform: uppercase; letter-spacing: .04em; margin-bottom: 2px; }
.sy-dist-row { display: flex; flex-direction: column; gap: 4px; }
.sy-dist-label { display: flex; align-items: center; justify-content: space-between; font-size: 12.5px; }
.sy-dist-bar { height: 6px; border-radius: 99px; background: var(--sy-well); overflow: hidden; }
.sy-dist-bar i { display: block; height: 100%; border-radius: 99px; background: var(--sy-accent); }
.sy-retro-form { display: flex; flex-direction: column; gap: 10px; }
.sy-retro-form-foot { display: flex; justify-content: flex-end; gap: 8px; }
.sy-retro-recent { display: flex; flex-direction: column; gap: 6px; padding-top: 8px; border-top: 1px solid var(--sy-line); }
.sy-retro-recent-item { display: flex; align-items: center; gap: 8px; padding: 6px 8px; border-radius: 8px; background: var(--sy-well); font-size: 12.5px; text-align: left; }
.sy-retro-recent-item .badge { font: 500 10.5px/1 var(--sy-mono); padding: 3px 6px; border-radius: 5px; background: var(--sy-accent-soft); color: var(--sy-accent-ink); flex: none; }
.sy-advice-list { display: flex; flex-direction: column; gap: 10px; }
.sy-advice-card { padding: 12px; border-radius: 12px; background: var(--sy-well); border: 1px solid var(--sy-line); display: flex; flex-direction: column; gap: 8px; }
.sy-advice-top { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; font-size: 13.5px; }
.sy-advice-card p { margin: 0; font-size: 12.5px; color: var(--sy-ink2); line-height: 1.45; }
.sy-advice-acts { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }

/* Modals for Capture & Detail */
.sy-capture-modal, .sy-detail-modal { width: min(640px, 100%); }
.sy-fld-row { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
.sy-detail-thumb, .sy-detail-preview { border-radius: 12px; overflow: hidden; max-height: 220px; background: var(--sy-well); }
.sy-detail-thumb img, .sy-detail-preview img { width: 100%; height: 100%; object-fit: cover; display: block; }

/* Unified classes for Stamps, Cards, Content, Schedule, and Modals */
.sy-ministamps { flex-direction: row; align-items: center; justify-content: space-between; gap: 10px; padding: 10px 12px; }
.sy-ministamps-row { display: flex; align-items: center; gap: 6px; overflow-x: auto; scrollbar-width: none; }
.sy-ministamps-row::-webkit-scrollbar { display: none; }
.sy-ministamps-more { display: inline-flex; align-items: center; gap: 4px; padding: 6px 10px; border-radius: 10px; background: var(--sy-accent-soft); color: var(--sy-accent-ink); font: 600 11.5px/1 var(--sy-mono); white-space: nowrap; flex: none; }
.sy-stamp { position: relative; width: 32px; height: 38px; border-radius: 7px; border: 1.5px dashed var(--sy-line2); background: var(--sy-card); display: grid; place-items: center; font: 600 12px/1 var(--sy-font); color: var(--sy-ink); overflow: hidden; flex: none; padding: 0; }
.sy-stamp.is-blank { background: var(--sy-well); color: var(--sy-ink3); box-shadow: none; filter: none; }
.sy-stamp.is-today { border-style: solid; border-color: var(--sy-accent); }
.sy-stamp.has-img img { width: 100%; height: 100%; object-fit: cover; display: block; }
.sy-stamp.is-type.tone-0 { background: color-mix(in srgb, var(--sy-t-task) 16%, var(--sy-card)); color: var(--sy-t-task); }
.sy-stamp.is-type.tone-1 { background: color-mix(in srgb, var(--sy-t-subscription) 16%, var(--sy-card)); color: var(--sy-t-subscription); }
.sy-stamp.is-type.tone-2 { background: color-mix(in srgb, var(--sy-t-bookmarks) 16%, var(--sy-card)); color: var(--sy-t-bookmarks); }
.sy-stamp.is-type.tone-3 { background: color-mix(in srgb, var(--sy-t-project) 16%, var(--sy-card)); color: var(--sy-t-project); }
.sy-stamp.is-type.tone-4 { background: color-mix(in srgb, var(--sy-t-habit) 16%, var(--sy-card)); color: var(--sy-t-habit); }
.sy-stamp.is-type.tone-5 { background: color-mix(in srgb, var(--sy-t-focus) 16%, var(--sy-card)); color: var(--sy-t-focus); }
.sy-stamp i { position: absolute; right: 2px; bottom: 2px; font: 600 9px/1 var(--sy-mono); padding: 1px 3px; border-radius: 4px; background: rgba(16,18,24,.75); color: #FFFFFF; }

.sy-mcard-media, .sy-mcard-fallback { position: relative; aspect-ratio: 16 / 9; background: var(--sy-well); overflow: hidden; flex: none; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; color: var(--sy-ink2); }
.sy-mcard-media img { width: 100%; height: 100%; object-fit: cover; display: block; }
.sy-mcard-top { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.sy-mcard-pill, .sy-status-pill { font: 600 11px/1.2 var(--sy-font); padding: 3px 8px; border-radius: 99px; background: var(--sy-accent-soft); color: var(--sy-accent-ink); white-space: nowrap; }
.sy-mcard-meta-tag { font: 500 11px/1.2 var(--sy-mono); padding: 2px 6px; border-radius: 6px; background: var(--sy-well); color: var(--sy-ink2); }
.sy-mcard-feishu { font-size: 11px; font-weight: 500; padding: 2px 6px; border-radius: 6px; background: color-mix(in srgb, var(--sy-t-bookmarks) 15%, transparent); color: var(--sy-t-bookmarks); }
.sy-mcard-desc { font-size: 12.5px; line-height: 1.5; color: var(--sy-ink2); margin: 0; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
.sy-mcard-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--sy-accent); flex: none; }
.sy-mcard-dot.status-curated { background: var(--sy-ok); }
.sy-mcard-dot.status-archived { background: var(--sy-ink3); }
.sy-mcard-source { font-size: 11.5px; color: var(--sy-ink2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sy-mcard-time { font: 11px var(--sy-mono); color: var(--sy-ink3); margin-left: auto; }
.sy-mini-act { font-size: 11.5px; padding: 3px 8px; border-radius: 7px; background: var(--sy-well); border: 1px solid var(--sy-line2); color: var(--sy-ink2); white-space: nowrap; }
.sy-mini-act:hover { color: var(--sy-ink); border-color: var(--sy-ink3); }

.sy-app-page { display: flex; flex-direction: column; gap: 14px; padding-top: 12px; }
.sy-view-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 14px; flex-wrap: wrap; }
.sy-view-title { font-size: 24px; font-weight: 600; letter-spacing: -.02em; margin: 0 0 4px; }
.sy-view-sub { font-size: 13px; color: var(--sy-ink2); margin: 0; }
.sy-view-controls { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.sy-search-pill { display: inline-flex; align-items: center; gap: 6px; height: 34px; padding: 0 12px; border-radius: 10px; background: var(--sy-card); border: 1px solid var(--sy-line2); color: var(--sy-ink3); }
.sy-search-pill input { border: 0; outline: 0; background: transparent; color: var(--sy-ink); min-width: 180px; }
.sy-filter-bar { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.sy-chip { height: 28px; padding: 0 11px; border-radius: 99px; border: 1px solid var(--sy-line2); background: var(--sy-card); font-size: 12.5px; color: var(--sy-ink2); }
.sy-chip.is-on { background: var(--sy-ink); color: var(--sy-bg); border-color: var(--sy-ink); }
.sy-empty-box { background: var(--sy-card); border: 1.5px dashed var(--sy-line2); border-radius: 18px; padding: 36px 20px; text-align: center; color: var(--sy-ink2); }
.sy-kanban-board[data-cols="3"] { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.sy-kanban-col.is-over { border-color: var(--sy-accent); background: var(--sy-accent-soft); }
.sy-kanban-head { display: flex; align-items: center; gap: 8px; padding-bottom: 8px; border-bottom: 1px solid var(--sy-line); }
.sy-kanban-head h3 { font-size: 13.5px; font-weight: 600; margin: 0; flex: 1; }
.sy-kanban-list { display: flex; flex-direction: column; gap: 10px; min-height: 160px; }
.sy-td-main { display: flex; align-items: center; gap: 10px; }
.sy-td-Main div, .sy-td-main div { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.sy-td-main small { font-size: 12px; color: var(--sy-ink2); }
.sy-td-thumb { width: 36px; height: 36px; border-radius: 8px; background: var(--sy-well); display: grid; place-items: center; overflow: hidden; flex: none; font-weight: 600; }
.sy-td-thumb img { width: 100%; height: 100%; object-fit: cover; }

.sy-cal-month { display: flex; flex-direction: column; line-height: 1.15; }
.sy-cal-month span { font: 500 11px/1 var(--sy-mono); color: var(--sy-ink3); }
.sy-cal-month em { font-style: normal; font-size: 17px; font-weight: 600; }
.sy-cal-stats { display: flex; align-items: center; gap: 16px; margin: 0 0 0 12px; }
.sy-cal-stats div { display: flex; flex-direction: column; gap: 2px; }
.sy-cal-stats dt { font-size: 11px; color: var(--sy-ink3); }
.sy-cal-stats dd { margin: 0; font: 600 15px/1 var(--sy-mono); }
.sy-cal-stats dd small { font-size: 11px; font-weight: 400; margin-left: 2px; color: var(--sy-ink2); }
.sy-cal-weeks { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 6px; text-align: center; font: 500 11.5px/1 var(--sy-mono); color: var(--sy-ink3); padding: 4px 0; }
.sy-cal-grid.is-week .sy-cal-cell { min-height: 220px; }
.sy-cal-cell.is-outside { opacity: .45; }
.sy-cal-cell.is-today { border-color: color-mix(in srgb, var(--sy-accent) 55%, transparent); background: color-mix(in srgb, var(--sy-accent) 5%, var(--sy-card)); }
.sy-cal-cell.is-selected { outline: 2px solid var(--sy-accent); outline-offset: -1px; background: var(--sy-card); }
.sy-cal-cell.is-over { background: var(--sy-accent-soft); border-color: var(--sy-accent); }
.sy-cal-date { font: 600 12px/1 var(--sy-mono); color: var(--sy-ink2); display: inline-flex; align-items: center; gap: 4px; }
.sy-cal-date small { font-size: 10px; padding: 1px 4px; border-radius: 4px; background: var(--sy-accent-soft); color: var(--sy-accent-ink); }
.sy-cal-chip.is-done { opacity: .55; text-decoration: line-through; }
.sy-cal-chip-title { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sy-cal-chip-sub { font: 500 10px/1 var(--sy-mono); color: var(--sy-ink3); }
.sy-day-agenda { display: flex; flex-direction: column; gap: 10px; padding-top: 12px; border-top: 1px solid var(--sy-line); }
.sy-day-agenda-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap; }
.sy-day-add-form, .sy-tray-add { display: flex; align-items: center; gap: 8px; }
.sy-day-add-form input, .sy-tray-add input { flex: 1; min-width: 0; height: 34px; border-radius: 10px; border: 1px solid var(--sy-line2); background: var(--sy-well); padding: 0 12px; outline: 0; }
.sy-day-agenda-list, .sy-tray-scroll { display: flex; flex-direction: column; gap: 6px; }
.sy-agenda-item, .sy-tray-item { display: flex; align-items: center; gap: 8px; padding: 8px 10px; border-radius: 10px; background: var(--sy-well); border: 1px solid var(--sy-line); cursor: pointer; }
.sy-agenda-item.is-done { opacity: .55; text-decoration: line-through; }
.sy-agenda-main, .sy-tray-item-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.sy-agenda-main p, .sy-tray-item-body small { margin: 0; font-size: 11.5px; color: var(--sy-ink3); }
.sy-prio-badge { font: 500 10.5px/1 var(--sy-mono); padding: 3px 6px; border-radius: 5px; background: var(--sy-accent-soft); color: var(--sy-accent-ink); }
.sy-prio-badge.prio-high { background: color-mix(in srgb, var(--sy-bad) 15%, transparent); color: var(--sy-bad); }
.sy-next-top, .sy-next-foot { display: flex; align-items: center; justify-content: space-between; gap: 8px; font-size: 12px; color: var(--sy-ink2); }
.sy-tray-head h2 { font-size: 14.5px; font-weight: 600; margin: 0 0 2px; }
.sy-drag-grip { font-family: var(--sy-mono); color: var(--sy-ink3); cursor: grab; }

.sy-modal { width: min(640px, 100%); max-height: min(760px, 92vh); background: var(--sy-card); border: 1px solid var(--sy-line); border-radius: 22px; box-shadow: var(--sy-shadow-lift); display: flex; flex-direction: column; overflow: hidden; }
.sy-modal-h { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 16px 18px 12px; border-bottom: 1px solid var(--sy-line); }
.sy-modal-b { padding: 16px 18px; overflow: auto; display: flex; flex-direction: column; gap: 12px; }
.sy-modal-f { display: flex; align-items: center; justify-content: flex-end; gap: 8px; padding: 12px 18px; border-top: 1px solid var(--sy-line); }
.sy-form-stack { display: flex; flex-direction: column; gap: 12px; }
.sy-form-row2 { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
.sy-form-row3 { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
.sy-field { display: flex; flex-direction: column; gap: 6px; }
.sy-field > span { font-size: 12px; font-weight: 600; color: var(--sy-ink2); }
.sy-field input, .sy-field select, .sy-field textarea { min-height: 36px; border-radius: 10px; border: 1px solid var(--sy-line2); background: var(--sy-well); color: var(--sy-ink); padding: 6px 12px; outline: 0; }
.sy-field textarea { resize: vertical; line-height: 1.5; }

@container sy (max-width: 980px) {
  .sy-kanban-board, .sy-kanban-board.cols-3 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .sy-schedule-layout { grid-template-columns: 1fr; }
  .sy-retro-hero, .sy-retro-trend, .sy-retro-dist, .sy-retro-reflect, .sy-retro-advice { grid-column: span 12; }
}

/* ============================================================================
   Phone overrides — LAST, on purpose.
   ============================================================================
   A container query adds no specificity, so it only wins on source order. Written above its base
   rule it loses silently, which is how a 20px headline still measured 24px on the first attempt.
   Everything a narrow screen needs to override therefore lives here, after every base rule.

   The sticky bar was the actual bug in the phone screenshot: it wrapped to four rows and stood
   156px tall (18% of a 844px viewport) with an opaque background, so a headline scrolling under
   it was sliced through the middle of its glyphs. Two rows plus the frosted tint above fix it.
   ============================================================================ */
@container sy (max-width: 640px) {
  .sy-topbar { gap: 8px; row-gap: 8px; padding-block: 9px; }
  .sy-brand { flex: none; font-size: 15px; gap: 6px; }
  .sy-brand span { display: none; }
  /* Share the brand's row and scroll, instead of taking a row of its own.
     The right edge fades out: a strip that is cut mid-button reads as broken, while a strip that
     fades reads as "there is more, swipe". The mask is what makes horizontal overflow legible
     without a scrollbar, which a touch device does not show. */
  .sy-seg-boards {
    flex: 1 1 0; min-width: 0;
    -webkit-mask-image: linear-gradient(to right, #000 calc(100% - 22px), transparent 100%);
    mask-image: linear-gradient(to right, #000 calc(100% - 22px), transparent 100%);
  }
  .sy-seg { padding: 2px; }
  .sy-seg button { padding: 6px 10px; font-size: 13px; }
  .sy-btn-add .lbl, .sy-btn-capture .lbl, .sy-switch .lbl { display: none; }
  .sy-btn-add, .sy-btn-capture { width: 34px; padding: 0; }
  .sy-cmd-box kbd { display: none; }
  .sy-actions { gap: 6px; }
  .sy-cmd { flex: 1 1 100%; }
  /* A headline is a lead paragraph on a phone, not a billboard: 24px pushes the first card off
     screen and wraps to four lines. */
  .sy-headline { font-size: 20px; max-width: none; text-wrap: pretty; }
  .sy-hero { flex-direction: column; align-items: stretch; gap: 10px; padding-block: 14px 12px; }
  .sy-hero-main, .sy-hero-aside { flex: 1 1 auto; width: 100%; }
  .sy-hero-capture-row { flex-wrap: wrap; }
  .sy-status { font-size: 11px; padding-bottom: 0; }
  .sy-kanban-board, .sy-kanban-board.cols-3 { grid-template-columns: 1fr; }
  .sy-retro-metrics { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .sy-fld-row { grid-template-columns: 1fr; }
}
/* .sy-page is the PARENT of the sy container, so a container query can never reach it — the
   first version put its padding here and nothing happened. Media queries are the right tool for
   a box that sizes the container. */
@media (max-width: 640px) {
  .sy-page { padding: 0 14px 80px; }
}
@container sy (max-width: 420px) {
  .sy-headline { font-size: 19px; }
  .sy-seg button { padding: 6px 8px; }
}
`
"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client/index.ts
var index_exports = {};
__export(index_exports, {
  PANEL_ID: () => PANEL_ID,
  SooyoIcon: () => SooyoIcon,
  clientPlugin: () => clientPlugin,
  default: () => index_default
});
module.exports = __toCommonJS(index_exports);
var React25 = __toESM(require("react"), 1);

// src/client/SooyoPanel.tsx
var React24 = __toESM(require("react"), 1);

// src/client/api/client.ts
var API = "/sooyo";
async function api(path, init) {
  const response = await fetch(API + path, {
    cache: "no-store",
    headers: { accept: "application/json", ...init?.headers ?? {} },
    ...init
  });
  const text = await response.text();
  const parsed = text ? (() => {
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  })() : null;
  if (!response.ok) throw new Error(parsed?.error ?? `HTTP ${response.status}`);
  return parsed;
}
function action(name, body, precondition) {
  return api("/action", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      name,
      body: body ?? {},
      ...precondition ? { precondition } : {}
    })
  });
}
function inferPrecondition(daily, name, body) {
  if (!daily || !body) return void 0;
  if (name === "task.update" || name === "task.remove") {
    const task = (daily.tasks ?? []).find((entry) => entry.id === body.id);
    if (Number.isSafeInteger(task?.revision)) {
      return { entity: "task", id: task.id, revision: task.revision };
    }
  }
  if (name === "note.remove") {
    const note = (daily.notes ?? []).find((entry) => entry.id === body.id);
    if (Number.isSafeInteger(note?.revision)) {
      return { entity: "note", id: note.id, revision: note.revision };
    }
  }
  if (name === "board.rename" || name === "board.remove") {
    const board = (daily.boards ?? []).find((entry) => entry.id === body.id);
    if (Number.isSafeInteger(board?.revision)) {
      return { entity: "board", id: board.id, revision: board.revision };
    }
  }
  if (name === "widget.update" || name === "widget.remove") {
    const widget = daily.widgets?.[body.id];
    if (Number.isSafeInteger(widget?.revision)) {
      return { entity: "widget", id: widget.id, revision: widget.revision };
    }
  }
  if (name === "layout.set" || name === "widget.resize") {
    const boardId = body.boardId ?? daily.active;
    const cols = body.cols ?? 12;
    const lKey = `${boardId}-${cols}`.replace(/[^a-zA-Z0-9_-]/g, "-");
    const rev = daily.layoutRevisions?.[lKey];
    if (Number.isSafeInteger(rev)) {
      return { entity: "layout", id: lKey, revision: rev };
    }
  }
  const settingsMap = {
    "interests.set": "interests",
    "bookmarks.set": "bookmarks",
    "habit.tick": "habits",
    "focus.set": "focus"
  };
  const sKey = settingsMap[name];
  if (sKey) {
    const rev = daily.settingsRevisions?.[sKey];
    if (Number.isSafeInteger(rev) && (rev ?? 0) > 0) {
      return { entity: "settings", id: sKey, revision: rev };
    }
  }
  return void 0;
}

// src/client/api/hooks.ts
var React = __toESM(require("react"), 1);
var { useState, useEffect, useCallback } = React;
function useDaily() {
  const [daily, setDaily] = useState(null);
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);
  const load = useCallback(async () => {
    try {
      const [snapshot, listing] = await Promise.all([
        api("/daily"),
        api("/items?limit=400&kind=all")
      ]);
      setDaily(snapshot);
      setItems(listing?.items ?? []);
      setError(null);
      setStatus("ready");
      return { snapshot, items: listing?.items ?? [] };
    } catch (failure) {
      setError(String(failure?.message ?? failure));
      setStatus("error");
      return null;
    }
  }, []);
  useEffect(() => {
    let live = true;
    void load().then((result) => {
      if (!live || !result) return;
      if ((result.items ?? []).length === 0) {
        void api("/refresh", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" }).then(
          () => setTimeout(() => {
            if (live) void load();
          }, 1500)
        ).catch(() => {
        });
      }
    });
    return () => {
      live = false;
    };
  }, [load]);
  const run = useCallback(
    async (name, body, options = {}) => {
      try {
        const precondition = options.precondition !== void 0 ? options.precondition : inferPrecondition(daily, name, body);
        const result = await action(name, body, precondition);
        if (result && result.ok === false) {
          if (result.code === "conflict") {
            await load();
            setToast({ text: String(result.error ?? "这条记录已被其它设备修改，已刷新到最新状态") });
            return result;
          }
          setToast({ text: String(result.error ?? "操作没有成功") });
          return result;
        }
        await load();
        if (options.toast) setToast({ text: options.toast });
        return result;
      } catch (failure) {
        setToast({ text: String(failure?.message ?? failure) });
        return null;
      }
    },
    [load, daily]
  );
  const refreshSources = useCallback(async () => {
    setStatus("refreshing");
    try {
      await api("/refresh", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
    } catch (failure) {
      setToast({ text: String(failure?.message ?? failure) });
    }
    await load();
  }, [load]);
  useEffect(() => {
    if (!toast) return void 0;
    const timer = setTimeout(() => setToast(null), 4200);
    return () => clearTimeout(timer);
  }, [toast]);
  return { daily, items, status, error, toast, setToast, run, refreshSources, reload: load };
}

// src/client/layout/breakpoints.ts
var GAP = 14;
var ROW = 88;
var sizeOrder = ["S", "M", "L", "Wide"];
var columnsFor = (width) => width >= 940 ? 12 : width >= 540 ? 6 : 4;
function footprint(types, type, size, cols) {
  const sizes = types[type]?.sizes ?? { S: [3, 2] };
  const [width, height] = sizes[size] ?? Object.values(sizes)[0] ?? [3, 2];
  if (cols >= 12) return [width, height];
  if (cols === 6) return [width >= 6 ? 6 : 3, height];
  return [size === "S" ? 2 : 4, height];
}
function fitDom(root) {
  if (!root) return;
  for (const element of Array.from(root.querySelectorAll(".sy-fit, .sy-fit-x"))) {
    for (const child of Array.from(element.children)) {
      if (child instanceof HTMLElement && child.dataset.syFitHidden === "1") {
        child.style.display = "";
        delete child.dataset.syFitHidden;
      }
    }
    const horizontal = element.classList.contains("sy-fit-x");
    const overflows = () => horizontal ? element.scrollWidth > element.clientWidth + 1 : element.scrollHeight > element.clientHeight + 1;
    const visibleChildren = () => Array.from(element.children).filter(
      (child) => child instanceof HTMLElement && child.dataset.syFitHidden !== "1"
    );
    let guard = 60;
    while (guard-- > 0) {
      const vis = visibleChildren();
      if (vis.length <= 1 || !overflows()) break;
      const last = vis[vis.length - 1];
      if (last) {
        last.style.display = "none";
        last.dataset.syFitHidden = "1";
      }
    }
    while (true) {
      const vis = visibleChildren();
      const last = vis[vis.length - 1];
      if (vis.length > 1 && last && last.classList.contains("sy-agenda-h")) {
        last.style.display = "none";
        last.dataset.syFitHidden = "1";
      } else {
        break;
      }
    }
  }
}

// src/client/layout/bento-packer.ts
function pack(types, widgets, order, cols) {
  const occupied = [];
  const positions = {};
  const free = (x, y, width, height) => {
    for (let row = y; row < y + height; row += 1) {
      for (let col = x; col < x + width; col += 1) {
        if (occupied[row]?.[col]) return false;
      }
    }
    return true;
  };
  for (const entry of order) {
    const widget = widgets[entry.id];
    if (!widget) continue;
    const [width, height] = footprint(types, widget.type, entry.size, cols);
    let placed = false;
    for (let y = 0; !placed; y += 1) {
      for (let x = 0; x <= cols - width; x += 1) {
        if (!free(x, y, width, height)) continue;
        for (let row = y; row < y + height; row += 1) {
          occupied[row] = occupied[row] ?? [];
          for (let col = x; col < x + width; col += 1) {
            occupied[row][col] = 1;
          }
        }
        positions[entry.id] = { x, y, w: width, h: height };
        placed = true;
        break;
      }
    }
  }
  return positions;
}
function startDrag(event, card, widgetId, layout, boardId, commit) {
  const rect = card.getBoundingClientRect();
  const start = { x: event.clientX, y: event.clientY };
  let ghost = null;
  let lockUntil = 0;
  const order = [...layout];
  const move = (moveEvent) => {
    if (!ghost) {
      if (Math.hypot(moveEvent.clientX - start.x, moveEvent.clientY - start.y) < 5) return;
      ghost = card.cloneNode(true);
      ghost.classList.add("sy-ghost");
      ghost.style.width = `${rect.width}px`;
      ghost.style.height = `${rect.height}px`;
      ghost.style.gridColumn = "";
      ghost.style.gridRow = "";
      document.body.appendChild(ghost);
      card.classList.add("is-ph");
    }
    ghost.style.left = `${moveEvent.clientX - (start.x - rect.left)}px`;
    ghost.style.top = `${moveEvent.clientY - (start.y - rect.top)}px`;
    if (performance.now() < lockUntil) return;
    const over = document.elementsFromPoint(moveEvent.clientX, moveEvent.clientY).find((element) => element instanceof HTMLElement && element.matches(".sy-grid > .sy-w") && element !== card);
    if (!over) return;
    const overRect = over.getBoundingClientRect();
    const inX = (moveEvent.clientX - overRect.left) / overRect.width;
    const inY = (moveEvent.clientY - overRect.top) / overRect.height;
    if (inX < 0.15 || inX > 0.85 || inY < 0.15 || inY > 0.85) return;
    const from = order.findIndex((entry) => entry.id === widgetId);
    const to = order.findIndex((entry) => entry.id === over.dataset.id);
    if (from < 0 || to < 0 || from === to) return;
    const [moved] = order.splice(from, 1);
    if (!moved) return;
    order.splice(to, 0, moved);
    lockUntil = performance.now() + 280;
    commit(order);
  };
  const finish = () => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", finish);
    window.removeEventListener("pointercancel", finish);
    ghost?.remove();
    card.classList.remove("is-ph");
  };
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", finish);
  window.addEventListener("pointercancel", finish);
  void boardId;
}
function startResize(_event, card, widgetId, cols, types, widgets, layout, commit) {
  const rect = card.getBoundingClientRect();
  const gridElement = card.parentElement;
  const style = gridElement ? window.getComputedStyle(gridElement) : null;
  const gap = Number.parseFloat(style?.columnGap ?? `${GAP}`) || GAP;
  const rowPx = Number.parseFloat(style?.gridAutoRows ?? `${ROW}`) || ROW;
  const colWidth = ((gridElement?.clientWidth ?? 1200) - gap * (cols - 1)) / cols;
  const widget = widgets[widgetId];
  const sizes = Object.keys((widget ? types[widget.type]?.sizes : void 0) ?? {});
  const move = (moveEvent) => {
    if (!widget) return;
    const usedCols = (moveEvent.clientX - rect.left + gap / 2) / (colWidth + gap);
    const usedRows = (moveEvent.clientY - rect.top + gap / 2) / (rowPx + gap);
    let best = null;
    let bestDistance = Infinity;
    for (const size of sizes) {
      const [width, height] = footprint(types, widget.type, size, cols);
      const distance = (width - usedCols) ** 2 + (height - usedRows) ** 2 * 1.4;
      if (distance < bestDistance) {
        bestDistance = distance;
        best = size;
      }
    }
    const current = layout.find((entry) => entry.id === widgetId)?.size;
    if (best && best !== current) commit(widgetId, best);
  };
  const finish = () => {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", finish);
  };
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", finish);
}

// src/client/shell/BoardTabs.tsx
var React3 = __toESM(require("react"), 1);

// src/client/widgets/shared.tsx
var React2 = __toESM(require("react"), 1);
var ASSET = `${API}/assets/a`;
var BRAND_APP = '<rect width="320" height="320" rx="76" fill="#282D55"/><g transform="translate(15 36) scale(.8)"><path d="M205 23V44M162 42L173 56M249 38L237 54" fill="none" stroke="#DF793D" stroke-width="13" stroke-linecap="round"/><path d="M19 116C55 110 112 118 147 142C151 100 171 70 203 69C219 68 233 73 245 81C263 77 280 78 284 85C271 89 260 98 256 109L253 137C286 120 322 114 347 116Q361 116 357 132C345 191 306 221 244 219L215 217L221 250Q224 266 208 265Q199 274 189 266Q175 274 168 264Q152 269 147 260Q143 255 150 245L165 217C80 231 30 204 16 135Q10 119 19 116Z" fill="#F1D5BC"/><path d="M147 142C151 100 171 70 203 69C219 68 233 73 245 81C263 77 280 78 284 85C271 89 260 98 256 109C256 158 238 179 208 181C178 183 154 168 147 142Z" fill="#344DA8" opacity=".7"/><path d="M171 110C187 81 216 78 238 99C224 128 195 136 171 110Z" fill="#FFF6EC"/><path d="M190 106C190 91 215 86 220 101C224 116 197 123 191 111Z" fill="#282D55"/><path d="M58 134H75Q84 134 84 143V155Q84 163 76 163H58Q50 163 50 155V143Q50 134 58 134Z" fill="#344DA8"/><path d="M98 134H114Q123 134 123 143V155Q123 163 115 163H98Q90 163 90 155V143Q90 134 98 134Z" fill="#E9B68C"/><path d="M62 169H78Q87 169 87 178V190Q87 199 79 199H63Q54 199 54 190V178Q54 169 62 169Z" fill="#E9B68C"/><path d="M102 169H118Q127 169 127 178V190Q127 199 119 199H103Q94 199 94 190V178Q94 169 102 169Z" fill="#E9B68C"/><path d="M263 142L317 137Q333 136 326 153L313 181Q309 192 298 193L253 196Q239 197 244 182L252 153Q255 144 263 142Z" fill="#FFF6EC"/><path d="M270 156H310M264 176H299" fill="none" stroke="#344DA8" stroke-width="8" stroke-linecap="round"/><path d="M150 217C163 192 179 175 200 176C222 177 232 195 224 212C207 234 175 231 150 217Z" fill="#F1D5BC"/></g>';
var BRAND_SMALL = '<path fill="currentColor" fill-rule="evenodd" d="M2 8.5C5 8 8 9 10 10.6C10.3 7.2 12 5 14.4 5C15.5 5 16.4 5.4 17 5.8C18.2 5.5 19.2 5.6 19.6 6.1L17.8 7.3L17.5 10.1C19.2 9.2 21.2 8.7 23 8.8C22.3 13.8 19.6 16.2 15 16L15.5 18.8Q15.8 20 14.5 19.8Q13.7 20.5 13 19.8Q11.5 20.5 10.8 19.5L12.1 16.4C6 17.5 2.2 14.7 1.3 9.5Q1.1 8.6 2 8.5ZM11.7 8.3Q13.5 5.5 16.3 7.6Q14.5 10.4 11.7 8.3ZM4 10H6V12H4ZM7 10H9V12H7ZM4.6 13H6.6V15H4.6ZM7.6 13H9.6V15H7.6ZM18 11H21V12.5H18Z"/><circle cx="14" cy="7.9" r=".85" fill="currentColor"/><path d="M14 1.4V3M10.6 2.5L11.5 3.6M17.3 2.4L16.4 3.6" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>';
var safeUrl = (value) => /^https?:\/\//i.test(String(value ?? "")) ? String(value) : "#";
var pad2 = (n) => String(n).padStart(2, "0");
var WEEK = ["日", "一", "二", "三", "四", "五", "六"];
var fmtCount = (n) => {
  const v = Number(n || 0);
  return v >= 1e4 ? `${(v / 1e4).toFixed(v >= 1e5 ? 0 : 1)} 万` : v.toLocaleString("en-US");
};
var relTime = (iso) => {
  const parsed = Date.parse(iso ?? "");
  if (!Number.isFinite(parsed)) return "";
  const minutes = Math.max(1, Math.round((Date.now() - parsed) / 6e4));
  if (minutes < 60) return `${minutes} 分钟前`;
  if (minutes < 60 * 24) return `${Math.round(minutes / 60)} 小时前`;
  return `${Math.round(minutes / 1440)} 天前`;
};
var hueOf = (text) => {
  let hue = 0;
  for (const char of String(text ?? "")) hue = (hue * 31 + char.charCodeAt(0)) % 360;
  return hue;
};
var tint = (text) => `hsl(${hueOf(text)} 42% 52%)`;
var greeting = () => {
  const hour = (/* @__PURE__ */ new Date()).getHours();
  return hour < 5 ? "夜深了" : hour < 11 ? "早上好" : hour < 13 ? "中午好" : hour < 18 ? "下午好" : "晚上好";
};
var dayIdx = () => ((/* @__PURE__ */ new Date()).getDay() + 6) % 7;
var CATEGORY_LABELS = {
  "ai-models": "模型",
  "ai-products": "产品",
  industry: "行业",
  paper: "论文",
  opinion: "观点",
  tip: "技巧",
  hot: "热榜",
  product: "产品",
  podcast: "视频"
};
var CATEGORY_COLOUR = {
  "ai-models": "var(--sy-t-task)",
  "ai-products": "var(--sy-t-subscription)",
  industry: "var(--sy-t-bookmarks)",
  paper: "var(--sy-t-project)",
  opinion: "var(--sy-t-habit)",
  tip: "var(--sy-t-readlater)"
};
var categoryLabel = (value) => value ? CATEGORY_LABELS[value] ?? null : null;
var OPERATION_LABELS = {
  "task.add": "新建任务",
  "task.update": "修改任务",
  "note.add": "记录笔记",
  "readlater.set": "稍后读",
  "board.create": "新建看板",
  "widget.add": "添加组件",
  "widget.update": "调整组件",
  "layout.set": "调整布局"
};
var STATUS_LABELS = {
  pending: "待批准",
  approved: "已批准",
  rejected: "已拒绝",
  applied: "已执行",
  rolled_back: "已撤销",
  failed: "执行失败",
  expired: "已过期"
};
var I = {
  dots: '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><circle cx="3.5" cy="8" r="1.4"/><circle cx="8" cy="8" r="1.4"/><circle cx="12.5" cy="8" r="1.4"/></svg>',
  check: '<svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 6.2l2.3 2.3 4.7-5"/></svg>',
  search: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="7" cy="7" r="4.6"/><path d="M10.5 10.5L14 14" stroke-linecap="round"/></svg>',
  plus: '<svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M8 3v10M3 8h10"/></svg>',
  bookmark: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M4 2.5h8v11L8 10.5l-4 3z"/></svg>',
  bookmarkOn: '<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M4 2.5h8v11L8 10.5l-4 3z"/></svg>',
  toTask: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="8" r="5.6"/><path d="M5.6 8.1l1.7 1.7 3.2-3.5"/></svg>',
  out: '<svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h7v7M13 3L4 12"/></svg>',
  note: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M3.5 2.5h6l3 3v8h-9z"/><path d="M6 8h4M6 10.5h3" stroke-linecap="round"/></svg>',
  x: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M4 4l8 8M12 4l-8 8"/></svg>',
  copy: '<svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="5" y="5" width="8.5" height="8.5" rx="2"/><path d="M11 3.2A1.8 1.8 0 0 0 9.3 2H4a2 2 0 0 0-2 2v5.3A1.8 1.8 0 0 0 3.2 11"/></svg>',
  sun: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="8" cy="8" r="3"/><path d="M8 1.5v1.6M8 12.9v1.6M1.5 8h1.6M12.9 8h1.6M3.4 3.4l1.1 1.1M11.5 11.5l1.1 1.1M3.4 12.6l1.1-1.1M11.5 4.5l1.1-1.1"/></svg>',
  moon: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><path d="M13.2 10A5.6 5.6 0 0 1 6 2.8a5.6 5.6 0 1 0 7.2 7.2z"/></svg>',
  play: '<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M5 3.2v9.6a.6.6 0 0 0 .9.5l7.6-4.8a.6.6 0 0 0 0-1L5.9 2.7a.6.6 0 0 0-.9.5z"/></svg>',
  pause: '<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><rect x="4" y="3" width="2.8" height="10" rx=".8"/><rect x="9.2" y="3" width="2.8" height="10" rx=".8"/></svg>',
  reset: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8a5 5 0 1 0 1.6-3.7M3 2.8v2.6h2.6"/></svg>',
  resize: '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M10.5 4.5v6h-6M10.5 10.5L5 5"/></svg>',
  warn: '<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M10 3l7.5 13h-15z"/><path d="M10 8v3.6M10 14v.2" stroke-linecap="round"/></svg>',
  home: '<svg width="19" height="19" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><rect x="3" y="3" width="6" height="6" rx="1.6"/><rect x="11" y="3" width="6" height="6" rx="1.6"/><rect x="3" y="11" width="6" height="6" rx="1.6"/><rect x="11" y="11" width="6" height="6" rx="1.6"/></svg>',
  work: '<svg width="19" height="19" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><rect x="2.5" y="6" width="15" height="10.5" rx="2.2"/><path d="M7 6V4.6A1.6 1.6 0 0 1 8.6 3h2.8A1.6 1.6 0 0 1 13 4.6V6M2.5 10.5h15"/></svg>',
  life: '<svg width="19" height="19" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M16.5 3.5C9 3.5 4 7 4 12.5c0 1.6.6 3 1.4 4M16.5 3.5c0 7.5-4 12-9.6 12.4M8.5 11.5L4 16"/></svg>',
  read: '<svg width="19" height="19" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M10 5.2C8.4 4 6 3.5 3 3.6v11.6c3-.1 5.4.4 7 1.6 1.6-1.2 4-1.7 7-1.6V3.6c-3-.1-5.4.4-7 1.6zM10 5.2v11.6"/></svg>',
  spark: '<svg width="10" height="10" viewBox="0 0 12 12" fill="currentColor"><path d="M6 .8l1.2 3.6a1 1 0 0 0 .5.5L11.2 6l-3.5 1.2a1 1 0 0 0-.5.5L6 11.2 4.8 7.7a1 1 0 0 0-.5-.5L.8 6l3.5-1.2a1 1 0 0 0 .5-.5z"/></svg>',
  up: '<svg width="10" height="10" viewBox="0 0 12 12" fill="currentColor"><path d="M6 2l4.5 7h-9z"/></svg>',
  board: '<svg width="19" height="19" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="3" width="14" height="14" rx="3"/><path d="M3 8h14M8 8v9"/></svg>'
};
function SvgIcon({ svg }) {
  return /* @__PURE__ */ React2.createElement("span", { style: { display: "contents" }, dangerouslySetInnerHTML: { __html: svg } });
}
function WidgetIcon({ type, size = 22 }) {
  const [fallback, setFallback] = React2.useState(false);
  return /* @__PURE__ */ React2.createElement(
    "span",
    {
      className: "sy-ic",
      "data-fallback": fallback ? "1" : void 0,
      style: { "--s": `${size}px`, "--ic-c": `var(--sy-t-${type})` }
    },
    !fallback ? /* @__PURE__ */ React2.createElement("img", { src: `${ASSET}/${type}.webp`, alt: "", onError: () => setFallback(true) }) : null
  );
}
function DecoImg({ name }) {
  const [hidden, setHidden] = React2.useState(false);
  if (hidden) return /* @__PURE__ */ React2.createElement("div", { className: "sy-deco" });
  return /* @__PURE__ */ React2.createElement("div", { className: "sy-deco" }, /* @__PURE__ */ React2.createElement("img", { src: `${ASSET}/${name}.webp`, alt: "", onError: () => setHidden(true) }));
}
function ProgressBar({ pct, colour }) {
  return /* @__PURE__ */ React2.createElement("div", { className: "sy-bar", style: { "--c": colour } }, /* @__PURE__ */ React2.createElement("i", { style: { width: `${Math.round(Math.max(0, Math.min(1, pct)) * 100)}%` } }));
}
function ProgressRing({
  pct,
  size,
  stroke,
  colour,
  label
}) {
  const radius = (size - stroke) / 2;
  const length = 2 * Math.PI * radius;
  const dash = length * (1 - Math.max(0, Math.min(1, pct)));
  return /* @__PURE__ */ React2.createElement("div", { className: "sy-ring", style: { width: size, height: size } }, /* @__PURE__ */ React2.createElement("svg", { width: size, height: size, viewBox: `0 0 ${size} ${size}` }, /* @__PURE__ */ React2.createElement("circle", { cx: size / 2, cy: size / 2, r: radius, fill: "none", stroke: "var(--sy-well)", strokeWidth: stroke }), /* @__PURE__ */ React2.createElement(
    "circle",
    {
      cx: size / 2,
      cy: size / 2,
      r: radius,
      fill: "none",
      stroke: colour,
      strokeWidth: stroke,
      strokeLinecap: "round",
      strokeDasharray: length,
      strokeDashoffset: dash,
      transform: `rotate(-90 ${size / 2} ${size / 2})`,
      style: { transition: "stroke-dashoffset .5s ease" }
    }
  )), /* @__PURE__ */ React2.createElement("b", null, label));
}
function MonoTile({ name, colour }) {
  const first = [...String(name).replace(/^(Sample|示例)\s*/, "")][0] ?? "·";
  return /* @__PURE__ */ React2.createElement("span", { className: "sy-mono-t", style: { "--c": colour || tint(name) } }, first);
}
var EMPTY_TEXT = {
  task: { ill: "ill-done", text: "今天的事都做完了。新任务会先进收件箱。" },
  subscription: { text: "这个订阅暂时没有新内容，到下次刷新再看看。" },
  readlater: { ill: "ill-readlater", text: "还没有稍后读。在订阅里点书签图标，文章就会存到这里。" },
  capture: { text: "还没有记录。在上面输入一行，回车就存好了。" },
  notes: { text: "还没有笔记。在快速记录里用 #note 开头输入即可创建。" },
  project: { text: "还没有项目。把任务归到一个项目下，这里就会显示它的进度。" },
  habit: { text: "还没有习惯。" },
  bookmarks: { text: "还没有书签。" },
  focus: { ill: "ill-focus", text: "准备好了就开始一个番茄。" }
};
function widgetTitle(widget, ctx) {
  if (widget?.title) return widget.title;
  if (widget?.type === "subscription") {
    const sources = Array.isArray(widget.settings?.sources) ? widget.settings.sources : [];
    const labels = sources.map((id) => ctx.sources.find((source) => source.id === id)?.label).filter(Boolean);
    return labels.join(" + ") || "订阅";
  }
  return (widget?.type ? ctx.types?.[widget.type]?.name : void 0) ?? widget?.type ?? "Widget";
}
function EmptyWidgetState({
  widget,
  size,
  context
}) {
  const entry = EMPTY_TEXT[widget.type] ?? { text: "这里还没有内容。" };
  const [illErr, setIllErr] = React2.useState(false);
  if (size === "S") {
    return /* @__PURE__ */ React2.createElement(React2.Fragment, null, /* @__PURE__ */ React2.createElement("div", { className: "sy-s-lab" }, widgetTitle(widget, context)), /* @__PURE__ */ React2.createElement("div", { className: "sy-state" }, /* @__PURE__ */ React2.createElement("p", { style: { fontSize: 13 } }, entry.text)));
  }
  if (entry.ill) {
    return /* @__PURE__ */ React2.createElement("div", { className: "sy-state-ill" }, !illErr ? /* @__PURE__ */ React2.createElement("img", { src: `${ASSET}/${entry.ill}.webp`, alt: "", onError: () => setIllErr(true) }) : null, /* @__PURE__ */ React2.createElement("p", { className: "sy-reason-plain", style: { margin: 0, fontSize: 13.5 } }, entry.text));
  }
  return /* @__PURE__ */ React2.createElement("div", { className: "sy-state" }, /* @__PURE__ */ React2.createElement("p", null, entry.text));
}
function projectsOf(tasks) {
  const names = [...new Set(tasks.map((task) => task.project).filter((p) => Boolean(p)))];
  return names.map((name) => {
    const rows = tasks.filter((task) => task.project === name);
    const done = rows.filter((task) => task.done).length;
    return {
      name,
      total: rows.length,
      done,
      open: rows.length - done,
      progress: rows.length ? done / rows.length : 0
    };
  });
}
var coverOf = (item) => item?.thumbnail ?? item?.cover ?? null;
var matchOf = (item, interests) => {
  if (!Array.isArray(interests) || interests.length === 0 || !item) return null;
  const hay = [item.title, item.summary, item.tldr, item.reason, ...item.keywords ?? []].join(" ").toLowerCase();
  return interests.find((keyword) => keyword && hay.includes(String(keyword).toLowerCase())) ?? null;
};
function MatchChip({ item, interests }) {
  const keyword = matchOf(item, interests);
  if (!keyword) return null;
  return /* @__PURE__ */ React2.createElement("span", { className: "sy-chip match", title: "命中你的关注词" }, /* @__PURE__ */ React2.createElement(SvgIcon, { svg: I.spark }), keyword);
}
function ScoreBadge({ item }) {
  if (typeof item?.score !== "number") return null;
  return /* @__PURE__ */ React2.createElement("span", { className: `sy-score${item.score >= 80 ? " hi" : ""}`, title: "AIHOT 评分" }, item.score);
}
function CategoryBadge({ item }) {
  const label = categoryLabel(item?.category);
  if (!label) return null;
  const colour = (item.category ? CATEGORY_COLOUR[item.category] : void 0) ?? "var(--sy-ink3)";
  return /* @__PURE__ */ React2.createElement("span", { className: "sy-cat", style: { "--c": colour } }, label);
}
function ItemActions({ item, saved }) {
  return /* @__PURE__ */ React2.createElement("span", { className: "sy-acts" }, /* @__PURE__ */ React2.createElement(
    "button",
    {
      "data-act": "item-later",
      "data-item": item.id,
      "aria-pressed": saved ? "true" : "false",
      "aria-label": saved ? "已在稍后读" : "稍后读",
      title: "稍后读"
    },
    /* @__PURE__ */ React2.createElement(SvgIcon, { svg: saved ? I.bookmarkOn : I.bookmark })
  ), /* @__PURE__ */ React2.createElement("button", { "data-act": "item-task", "data-item": item.id, "aria-label": "转为任务", title: "转为任务" }, /* @__PURE__ */ React2.createElement(SvgIcon, { svg: I.toTask })), /* @__PURE__ */ React2.createElement(
    "a",
    {
      href: safeUrl(item.url),
      target: "_blank",
      rel: "noopener noreferrer",
      "aria-label": "打开原文",
      title: "打开原文"
    },
    /* @__PURE__ */ React2.createElement(SvgIcon, { svg: I.out })
  ));
}
function ItemLink({
  item,
  className,
  children
}) {
  return /* @__PURE__ */ React2.createElement(
    "a",
    {
      className,
      "data-open": item.id,
      href: safeUrl(item.url),
      target: "_blank",
      rel: "noopener noreferrer"
    },
    children
  );
}
function ThumbBox({ item, label }) {
  const cover = coverOf(item);
  if (cover) {
    return /* @__PURE__ */ React2.createElement("img", { src: cover, alt: "", loading: "lazy" });
  }
  return /* @__PURE__ */ React2.createElement("div", { className: "sy-gen", style: { "--c": tint(item.sourceId + (label ?? "")) } }, label ?? "");
}

// src/client/shell/BoardTabs.tsx
function BoardTabs({ boards, activeBoard }) {
  return /* @__PURE__ */ React3.createElement("div", { className: "sy-seg sy-seg-boards", role: "tablist" }, boards.map((entry) => /* @__PURE__ */ React3.createElement(
    "button",
    {
      key: entry.id,
      role: "tab",
      "aria-pressed": entry.id === activeBoard,
      "data-act": "board",
      "data-board": entry.id
    },
    entry.name
  )), /* @__PURE__ */ React3.createElement("button", { className: "sy-seg-add", "data-act": "board-new", "aria-label": "新建 Board", title: "新建 Board" }, /* @__PURE__ */ React3.createElement(SvgIcon, { svg: I.plus })));
}

// src/client/shell/WidgetFrame.tsx
var React15 = __toESM(require("react"), 1);

// src/client/widgets/registry.ts
var React14 = __toESM(require("react"), 1);

// src/client/widgets/task/TaskWidget.tsx
var React4 = __toESM(require("react"), 1);
function tasksIn(tasks, settings, list) {
  return tasks.filter((task) => task.list === list && (!settings?.project || task.project === settings.project));
}
function TaskRow({ task, showProject }) {
  return /* @__PURE__ */ React4.createElement("div", { className: `sy-row sy-t-row${task.done ? " sy-done" : ""}` }, /* @__PURE__ */ React4.createElement(
    "button",
    {
      className: "sy-chk",
      "data-act": "task-toggle",
      "data-task": task.id,
      "aria-label": `${task.done ? "标记为未完成" : "完成"}：${task.title}`
    },
    /* @__PURE__ */ React4.createElement(SvgIcon, { svg: I.check })
  ), /* @__PURE__ */ React4.createElement("span", { className: "sy-t-title c1 grow" }, task.title), task.origin?.url ? /* @__PURE__ */ React4.createElement(
    "a",
    {
      className: "sy-chip",
      href: safeUrl(task.origin.url),
      target: "_blank",
      rel: "noopener noreferrer",
      title: `来自 ${task.origin.source ?? ""}，点开原文`
    },
    task.origin.source ?? ""
  ) : null, showProject && task.project ? /* @__PURE__ */ React4.createElement("span", { className: "sy-chip" }, task.project) : null, /* @__PURE__ */ React4.createElement("button", { className: "sy-mini", "data-act": "task-remove", "data-task": task.id, "aria-label": "删除任务", title: "删除" }, /* @__PURE__ */ React4.createElement(SvgIcon, { svg: I.x })));
}
function TaskWidget({ widget, size, settings, context }) {
  const tasks = context.tasks;
  const list = tasksIn(tasks, settings, "today");
  const open = list.filter((task) => !task.done);
  const done = list.filter((task) => task.done);
  const inbox = tasksIn(tasks, settings, "inbox");
  const later = tasksIn(tasks, settings, "later");
  const scope = settings?.project ? `${settings.project} · ` : "";
  if (size === "S") {
    if (open.length === 0) {
      return /* @__PURE__ */ React4.createElement(React4.Fragment, null, /* @__PURE__ */ React4.createElement("div", { className: "sy-s-lab" }, scope, "今天"), /* @__PURE__ */ React4.createElement("div", { className: "sy-s-main sy-s-narrow" }, /* @__PURE__ */ React4.createElement("div", { className: "sy-s-big" }, done.length, /* @__PURE__ */ React4.createElement("small", null, "/", list.length)), /* @__PURE__ */ React4.createElement("div", { className: "sy-s-sub" }, "今天的事都做完了")), /* @__PURE__ */ React4.createElement("div", null));
    }
    const first = open[0];
    return /* @__PURE__ */ React4.createElement(React4.Fragment, null, /* @__PURE__ */ React4.createElement("div", { className: "sy-s-lab" }, scope, "今天"), /* @__PURE__ */ React4.createElement("div", { className: "sy-s-main" }, /* @__PURE__ */ React4.createElement("div", { className: "sy-s-big" }, open.length), /* @__PURE__ */ React4.createElement("div", { className: "sy-s-sub" }, "件事还没做")), /* @__PURE__ */ React4.createElement(
      "button",
      {
        className: "sy-s-next",
        "data-act": "task-toggle",
        "data-task": first.id,
        "aria-label": `完成：${first.title}`
      },
      /* @__PURE__ */ React4.createElement("span", { className: "sy-chk" }, /* @__PURE__ */ React4.createElement(SvgIcon, { svg: I.check })),
      /* @__PURE__ */ React4.createElement("span", { className: "c1" }, first.title)
    ));
  }
  const progress = list.length ? done.length / list.length : 0;
  if (size === "M") {
    const shown = [...open, ...done].slice(0, 3);
    return /* @__PURE__ */ React4.createElement(React4.Fragment, null, /* @__PURE__ */ React4.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 7, flex: "none" } }, /* @__PURE__ */ React4.createElement("div", { style: { display: "flex", alignItems: "baseline", gap: 8 } }, /* @__PURE__ */ React4.createElement("span", { className: "sy-s-big", style: { fontSize: 36 } }, done.length, /* @__PURE__ */ React4.createElement("small", null, "/", list.length)), /* @__PURE__ */ React4.createElement("span", { className: "meta" }, "今天已完成")), /* @__PURE__ */ React4.createElement(ProgressBar, { pct: progress, colour: "var(--sy-t-task)" })), /* @__PURE__ */ React4.createElement("div", { className: "sy-list sy-fit", style: { gap: 3 } }, shown.map((task) => /* @__PURE__ */ React4.createElement("div", { key: task.id, className: `sy-row sy-t-row sy-t-m${task.done ? " sy-done" : ""}` }, /* @__PURE__ */ React4.createElement(
      "button",
      {
        className: "sy-chk",
        "data-act": "task-toggle",
        "data-task": task.id,
        "aria-label": `完成：${task.title}`
      },
      /* @__PURE__ */ React4.createElement(SvgIcon, { svg: I.check })
    ), /* @__PURE__ */ React4.createElement("span", { className: "sy-t-title c2 grow" }, task.title)))), /* @__PURE__ */ React4.createElement("div", { className: "meta", style: { flex: "none" } }, "收件箱 ", inbox.length, " · 之后 ", later.length));
  }
  const single = context.cols <= 4;
  return /* @__PURE__ */ React4.createElement(React4.Fragment, null, /* @__PURE__ */ React4.createElement("form", { className: "sy-cap", "data-form": "task-add", "data-w": widget.id, style: { height: 36 } }, /* @__PURE__ */ React4.createElement("input", { name: "t", placeholder: "新建任务，回车加入今天", autoComplete: "off", "aria-label": "新建任务" }), /* @__PURE__ */ React4.createElement("kbd", null, "↵")), /* @__PURE__ */ React4.createElement(
    "div",
    {
      style: {
        display: "grid",
        gridTemplateColumns: single ? "1fr" : "1fr 1fr",
        gap: 18,
        flex: 1,
        minHeight: 0
      }
    },
    /* @__PURE__ */ React4.createElement("section", { style: { display: "flex", flexDirection: "column", minHeight: 0 } }, /* @__PURE__ */ React4.createElement("div", { className: "sy-agenda-h" }, "今天 · ", open.length, "/", list.length), /* @__PURE__ */ React4.createElement("div", { className: "sy-list sy-fit" }, [...open, ...done].map((task) => /* @__PURE__ */ React4.createElement(TaskRow, { key: task.id, task, showProject: !single })))),
    !single ? /* @__PURE__ */ React4.createElement("section", { style: { display: "flex", flexDirection: "column", minHeight: 0 } }, /* @__PURE__ */ React4.createElement("div", { className: "sy-agenda-h" }, "收件箱 · ", inbox.length), /* @__PURE__ */ React4.createElement("div", { className: "sy-list sy-fit" }, inbox.length ? inbox.map((task) => /* @__PURE__ */ React4.createElement("div", { key: task.id, className: "sy-row" }, /* @__PURE__ */ React4.createElement("span", { className: "sy-t-title c1 grow" }, task.title), /* @__PURE__ */ React4.createElement("button", { className: "sy-mini", "data-act": "task-today", "data-task": task.id }, "移到今天"))) : /* @__PURE__ */ React4.createElement("div", { className: "meta", style: { padding: "8px 0" } }, "收件箱是空的"))) : null
  ));
}
var taskWidgetDefinition = {
  type: "task",
  name: "任务",
  desc: "今天要做的事，直接勾选完成",
  priority: "P0",
  sizes: { S: [3, 2], M: [3, 4], L: [6, 4] },
  defaultSize: "M",
  actions: ["勾选完成", "移到今天", "新建任务"],
  defaultSettings: () => ({}),
  normalizeSettings: (raw) => {
    const obj = raw && typeof raw === "object" ? raw : {};
    return {
      ...typeof obj.project === "string" && obj.project ? { project: obj.project } : {}
    };
  },
  Component: TaskWidget,
  computeLayoutMeta: ({ size, settings, context }) => {
    const list = tasksIn(context.tasks, settings, "today");
    const open = list.filter((task) => !task.done);
    if (size === "S") {
      return open.length === 0 ? { deco: "ill-done" } : {};
    }
    return { sub: `${open.length} 件待办` };
  }
};

// src/client/widgets/subscription/SubscriptionWidget.tsx
var React5 = __toESM(require("react"), 1);
var DECK_SIZE = 10;
var SUB_SORTS = [
  ["match", "关注优先"],
  ["new", "最新"],
  ["score", "评分"],
  ["rank", "排名"]
];
var isShort = (item) => item?.kind ? item.kind === "short" : /\/shorts\//.test(item?.url ?? "");
var cleanDesc = (text) => String(text ?? "").split("\n").map((line) => line.trim()).filter((line) => line && !/https?:/.test(line) && !/^[*•\-–]/.test(line)).join(" ").slice(0, 240);
function sortItems(items, sort, interests) {
  const recent = (a, b) => Date.parse(b.publishedAt ?? "") - Date.parse(a.publishedAt ?? "");
  const list = [...items];
  if (sort === "rank") list.sort((a, b) => (a.metrics?.rank ?? 99) - (b.metrics?.rank ?? 99));
  else if (sort === "score") {
    list.sort((a, b) => (b.metrics?.upvotes ?? b.score ?? 0) - (a.metrics?.upvotes ?? a.score ?? 0));
  } else if (sort === "match") {
    list.sort((a, b) => (matchOf(b, interests) ? 1 : 0) - (matchOf(a, interests) ? 1 : 0) || recent(a, b));
  } else list.sort(recent);
  return list;
}
function subItemsOf(widget, items, interests) {
  const settings = widget.settings ?? {};
  const sources = settings.sources?.length ? settings.sources : ["aihot"];
  let list = items.filter((item) => Boolean(item.sourceId && sources.includes(item.sourceId)));
  if (settings.cat) list = list.filter((item) => item.category === settings.cat);
  return sortItems(list, settings.sort ?? "new", interests);
}
var heatMax = (items) => Math.max(1, ...items.map((item) => item.metrics?.signalCount ?? 0));
var metaLine = (item) => {
  const metrics = item.metrics ?? {};
  if (item.sourceId === "hf-papers") {
    return `▲ ${metrics.upvotes ?? 0} · ${metrics.comments ?? 0} 评论 · ${relTime(item.publishedAt)}`;
  }
  if (item.sourceId === "youtube") {
    return `${metrics.views ? `${fmtCount(metrics.views)} 次观看 · ` : ""}${relTime(item.publishedAt)}`;
  }
  if (item.sourceId === "aihot-hot") return item.origin ?? "";
  return `${item.origin ?? item.sourceLabel ?? ""} · ${relTime(item.publishedAt)}`;
};
var authorsLine = (item) => item.tags?.length ? `${item.tags[0]}${(item.authorCount ?? item.tags.length) > 1 ? ` 等 ${item.authorCount ?? item.tags.length} 人` : ""}` : "";
var videoMeta = (item) => `${relTime(item.publishedAt)}${item.metrics?.views ? ` · ${fmtCount(item.metrics.views)} 次观看` : ""}${item.metrics?.likes ? ` · ${fmtCount(item.metrics.likes)} 赞` : ""}`;
function UpvotesBadge({ item, className = "" }) {
  return /* @__PURE__ */ React5.createElement("span", { className: `sy-up ${className}`.trim(), title: "HuggingFace 点赞" }, /* @__PURE__ */ React5.createElement(SvgIcon, { svg: I.up }), item.metrics?.upvotes ?? item.score ?? 0);
}
function KeywordChips({
  item,
  count,
  interests
}) {
  const keyword = matchOf(item, interests);
  const rest = (item.keywords ?? []).filter((value) => !keyword || !String(value).toLowerCase().includes(keyword.toLowerCase())).slice(0, keyword ? count - 1 : count);
  return /* @__PURE__ */ React5.createElement("div", { className: "sy-kws" }, keyword ? /* @__PURE__ */ React5.createElement("span", { className: "sy-chip match" }, /* @__PURE__ */ React5.createElement(SvgIcon, { svg: I.spark }), keyword) : null, rest.map((value, idx) => /* @__PURE__ */ React5.createElement("span", { key: idx, className: "sy-chip" }, value)));
}
function PaperLinks({ item }) {
  const id = String(item.url ?? "").match(/papers\/([\d.]+)/)?.[1];
  return /* @__PURE__ */ React5.createElement("div", { className: "sy-links" }, /* @__PURE__ */ React5.createElement("a", { href: safeUrl(item.url), target: "_blank", rel: "noopener noreferrer" }, "论文", id ? /* @__PURE__ */ React5.createElement("code", null, " ", id) : null, " ", /* @__PURE__ */ React5.createElement(SvgIcon, { svg: I.out })), item.altUrl ? /* @__PURE__ */ React5.createElement("a", { href: safeUrl(item.altUrl), target: "_blank", rel: "noopener noreferrer" }, "代码", item.metrics?.stars ? ` ★ ${fmtCount(item.metrics.stars)}` : "", " ", /* @__PURE__ */ React5.createElement(SvgIcon, { svg: I.out })) : null, item.project ? /* @__PURE__ */ React5.createElement("a", { href: safeUrl(item.project), target: "_blank", rel: "noopener noreferrer" }, "项目页 ", /* @__PURE__ */ React5.createElement(SvgIcon, { svg: I.out })) : null);
}
function NewsRow({ item, context }) {
  const colour = (item.category ? CATEGORY_COLOUR[item.category] : void 0) ?? "var(--sy-ink3)";
  const catLabel = categoryLabel(item.category);
  return /* @__PURE__ */ React5.createElement("div", { className: `sy-row nr${item.state?.seen ? " sy-seen" : ""}` }, /* @__PURE__ */ React5.createElement("i", { className: "sy-cdot", style: { "--c": colour } }), /* @__PURE__ */ React5.createElement(ItemLink, { item, className: "sy-it-a" }, /* @__PURE__ */ React5.createElement("span", { className: "tt c1" }, item.title), /* @__PURE__ */ React5.createElement("span", { className: "meta c1", style: { whiteSpace: "normal" } }, catLabel ? `${catLabel} · ` : "", item.origin ?? "", " · ", relTime(item.publishedAt))), /* @__PURE__ */ React5.createElement(MatchChip, { item, interests: context.interests }), typeof item.score === "number" ? /* @__PURE__ */ React5.createElement("span", { className: "sy-sc" }, item.score) : null, /* @__PURE__ */ React5.createElement(ItemActions, { item, saved: context.saved.has(item.id) }));
}
function NewsLead({ item, context, big }) {
  const cover = coverOf(item);
  return /* @__PURE__ */ React5.createElement("div", { className: `sy-lead sy-nl${item.state?.seen ? " sy-seen" : ""}` }, big && cover ? /* @__PURE__ */ React5.createElement(ItemLink, { item, className: "sy-nl-cover" }, /* @__PURE__ */ React5.createElement("img", { src: cover, alt: "" })) : null, /* @__PURE__ */ React5.createElement("div", { className: "sy-nl-t" }, /* @__PURE__ */ React5.createElement("div", { className: "sy-nl-top" }, /* @__PURE__ */ React5.createElement(ScoreBadge, { item }), /* @__PURE__ */ React5.createElement(CategoryBadge, { item }), /* @__PURE__ */ React5.createElement(MatchChip, { item, interests: context.interests })), /* @__PURE__ */ React5.createElement(ItemLink, { item, className: `sy-lead-t ${big ? "lg" : ""} c${big ? 2 : 3}`.trim() }, item.title), big && item.reason ? /* @__PURE__ */ React5.createElement("div", { className: "sy-reason c2" }, item.reason) : null, /* @__PURE__ */ React5.createElement("span", { className: "meta c1", style: { whiteSpace: "normal" } }, item.origin ?? "", " · ", relTime(item.publishedAt))), /* @__PURE__ */ React5.createElement(ItemActions, { item, saved: context.saved.has(item.id) }));
}
function NewsCard({ item, context }) {
  return /* @__PURE__ */ React5.createElement("div", { className: `sy-ncard${item.state?.seen ? " sy-seen" : ""}` }, /* @__PURE__ */ React5.createElement("div", { className: "sy-nl-top" }, /* @__PURE__ */ React5.createElement(ScoreBadge, { item }), /* @__PURE__ */ React5.createElement(CategoryBadge, { item }), /* @__PURE__ */ React5.createElement(MatchChip, { item, interests: context.interests })), /* @__PURE__ */ React5.createElement(ItemLink, { item, className: "sy-lead-t c3" }, item.title), item.reason ? /* @__PURE__ */ React5.createElement("div", { className: "sy-reason-plain c4" }, item.reason) : null, /* @__PURE__ */ React5.createElement("span", { className: "meta c1 foot", style: { whiteSpace: "normal" } }, item.origin ?? "", " · ", relTime(item.publishedAt)), /* @__PURE__ */ React5.createElement(ItemActions, { item, saved: context.saved.has(item.id) }));
}
function RankRow({ item, index, max }) {
  return /* @__PURE__ */ React5.createElement("div", { className: `sy-row sy-rk-row${item.state?.seen ? " sy-seen" : ""}` }, /* @__PURE__ */ React5.createElement("span", { className: `sy-rk-n${index < 3 ? " top" : ""}` }, item.metrics?.rank ?? index + 1), /* @__PURE__ */ React5.createElement(ItemLink, { item, className: "grow c1 tt" }, item.title), item.metrics?.signalCount ? /* @__PURE__ */ React5.createElement("span", { className: "sy-heat", title: item.origin ?? "" }, /* @__PURE__ */ React5.createElement("i", { style: { width: `${Math.round(item.metrics.signalCount / max * 100)}%` } })) : null);
}
function ProdRow({ item, context }) {
  return /* @__PURE__ */ React5.createElement("div", { className: "sy-row" }, /* @__PURE__ */ React5.createElement(MonoTile, { name: item.title }), /* @__PURE__ */ React5.createElement(ItemLink, { item, className: "sy-it-a" }, /* @__PURE__ */ React5.createElement("span", { className: "tt c1" }, item.title), /* @__PURE__ */ React5.createElement("span", { className: "meta c1", style: { whiteSpace: "normal" } }, item.summary ?? "")), /* @__PURE__ */ React5.createElement(ItemActions, { item, saved: context.saved.has(item.id) }));
}
function ProdCard({ item, context }) {
  return /* @__PURE__ */ React5.createElement("div", { className: "sy-ncard" }, /* @__PURE__ */ React5.createElement(MonoTile, { name: item.title }), /* @__PURE__ */ React5.createElement(ItemLink, { item, className: "sy-lead-t c1" }, item.title), /* @__PURE__ */ React5.createElement("div", { className: "meta c3", style: { whiteSpace: "normal", lineHeight: 1.5 } }, item.summary ?? ""), /* @__PURE__ */ React5.createElement(ItemActions, { item, saved: context.saved.has(item.id) }));
}
function PaperRow({
  item,
  index,
  withSummary,
  context
}) {
  return /* @__PURE__ */ React5.createElement("div", { className: `sy-row sy-pr${item.state?.seen ? " sy-seen" : ""}` }, /* @__PURE__ */ React5.createElement("span", { className: "sy-rk-n" }, index), /* @__PURE__ */ React5.createElement(ItemLink, { item, className: "sy-it-a" }, /* @__PURE__ */ React5.createElement("span", { className: "tt c1" }, item.title), withSummary ? /* @__PURE__ */ React5.createElement("span", { className: "meta c1", style: { whiteSpace: "normal" } }, item.tldr || authorsLine(item)) : null), /* @__PURE__ */ React5.createElement(MatchChip, { item, interests: context.interests }), /* @__PURE__ */ React5.createElement(UpvotesBadge, { item }), /* @__PURE__ */ React5.createElement(ItemActions, { item, saved: context.saved.has(item.id) }));
}
function PaperLead({ item, context }) {
  const cover = coverOf(item);
  return /* @__PURE__ */ React5.createElement("div", { className: "sy-lead sy-pl" }, cover ? /* @__PURE__ */ React5.createElement(ItemLink, { item, className: "sy-pl-fig" }, /* @__PURE__ */ React5.createElement("img", { src: cover, alt: "论文配图" })) : null, /* @__PURE__ */ React5.createElement("div", { className: "sy-pl-t" }, /* @__PURE__ */ React5.createElement("div", { className: "sy-nl-top" }, /* @__PURE__ */ React5.createElement("span", { className: "mono-l" }, "#1 今日"), /* @__PURE__ */ React5.createElement(UpvotesBadge, { item }), /* @__PURE__ */ React5.createElement("span", { className: "meta" }, item.metrics?.comments ?? 0, " 条讨论 · ", authorsLine(item))), /* @__PURE__ */ React5.createElement(ItemLink, { item, className: "sy-lead-t lg c2" }, item.title), item.tldr ? /* @__PURE__ */ React5.createElement("div", { className: "sy-tldr c2" }, item.tldr) : null, /* @__PURE__ */ React5.createElement(KeywordChips, { item, count: 4, interests: context.interests }), /* @__PURE__ */ React5.createElement(PaperLinks, { item })), /* @__PURE__ */ React5.createElement(ItemActions, { item, saved: context.saved.has(item.id) }));
}
function PaperCard({
  item,
  index,
  context
}) {
  return /* @__PURE__ */ React5.createElement("div", { className: "sy-ncard" }, /* @__PURE__ */ React5.createElement("div", { className: "sy-nl-top" }, /* @__PURE__ */ React5.createElement("span", { className: "mono-l" }, "#", index + 1), /* @__PURE__ */ React5.createElement(UpvotesBadge, { item }), /* @__PURE__ */ React5.createElement("span", { className: "meta" }, item.metrics?.comments ?? 0, " 条讨论")), /* @__PURE__ */ React5.createElement(ItemLink, { item, className: "sy-lead-t c2" }, item.title), /* @__PURE__ */ React5.createElement("div", { className: "sy-reason-plain c4" }, item.tldr || item.summary), /* @__PURE__ */ React5.createElement("div", { className: "foot" }, /* @__PURE__ */ React5.createElement(KeywordChips, { item, count: 3, interests: context.interests })), /* @__PURE__ */ React5.createElement(ItemActions, { item, saved: context.saved.has(item.id) }));
}
function VideoImg({ item }) {
  const cover = coverOf(item);
  if (cover) return /* @__PURE__ */ React5.createElement("img", { src: cover, alt: "", loading: "lazy" });
  return /* @__PURE__ */ React5.createElement("div", { className: "sy-gen", style: { "--c": "var(--sy-t-subscription)" } }, item.sourceLabel ?? "");
}
function VideoThumb({ item, className = "" }) {
  return /* @__PURE__ */ React5.createElement(ItemLink, { item, className: `sy-vt ${className}`.trim() }, /* @__PURE__ */ React5.createElement(VideoImg, { item }), /* @__PURE__ */ React5.createElement("span", { className: "sy-vplay" }, /* @__PURE__ */ React5.createElement(SvgIcon, { svg: I.play })), item.metrics?.views ? /* @__PURE__ */ React5.createElement("span", { className: "sy-vbadge" }, fmtCount(item.metrics.views), " 次观看") : null);
}
function ShortCard({ item }) {
  return /* @__PURE__ */ React5.createElement(ItemLink, { item, className: "sy-s916" }, /* @__PURE__ */ React5.createElement(VideoImg, { item }), /* @__PURE__ */ React5.createElement("span", null, /* @__PURE__ */ React5.createElement("em", { className: "c2" }, item.title), /* @__PURE__ */ React5.createElement("b", null, fmtCount(item.metrics?.views ?? 0), " 次观看")));
}
function EpisodeCard({ item }) {
  return /* @__PURE__ */ React5.createElement(ItemLink, { item, className: "sy-ep" }, /* @__PURE__ */ React5.createElement(VideoImg, { item }), /* @__PURE__ */ React5.createElement("span", { className: "sy-vplay" }, /* @__PURE__ */ React5.createElement(SvgIcon, { svg: I.play })), /* @__PURE__ */ React5.createElement("span", { className: "sy-ep-t" }, /* @__PURE__ */ React5.createElement("span", { className: "mono-l" }, isShort(item) ? "SHORTS" : "最新节目"), /* @__PURE__ */ React5.createElement("b", { className: "c2" }, item.title), /* @__PURE__ */ React5.createElement("span", null, videoMeta(item))));
}
function CategoryTabs({ widget, context }) {
  const settings = widget.settings ?? {};
  const all = subItemsOf({ ...widget, settings: { ...settings, cat: null } }, context.items, context.interests);
  const present = [...new Set(all.map((item) => item.category).filter((v) => Boolean(categoryLabel(v))))];
  if (present.length < 2) return null;
  const current = settings.cat ?? "";
  const tabs = [
    ["", "全部", all.length],
    ...present.map((v) => [
      v,
      categoryLabel(v) ?? v,
      all.filter((item) => item.category === v).length
    ])
  ];
  return /* @__PURE__ */ React5.createElement("div", { className: "sy-tabs", role: "tablist" }, tabs.map(([key, label, count]) => /* @__PURE__ */ React5.createElement(
    "button",
    {
      key,
      role: "tab",
      "data-act": "sub-cat",
      "data-w": widget.id,
      "data-v": key,
      "aria-pressed": current === key
    },
    label,
    /* @__PURE__ */ React5.createElement("span", null, count)
  )));
}
function SubscriptionDeck({
  widget,
  size,
  items,
  context
}) {
  const list = items.slice(0, DECK_SIZE);
  const settings = widget.settings ?? {};
  const vertical = size === "S";
  const max = heatMax(list);
  if (list.length === 0) {
    return /* @__PURE__ */ React5.createElement(EmptyWidgetState, { widget, size, context });
  }
  const index = context.deckIndex[widget.id] ?? 0;
  const flipped = Boolean(context.deckFlipped[widget.id]);
  const at = Math.min(index, list.length - 1);
  const big = size !== "M";
  return /* @__PURE__ */ React5.createElement(
    "div",
    {
      className: `sy-deck${vertical ? " v" : ""}`,
      "data-deck": widget.id,
      tabIndex: 0,
      role: "group",
      "aria-roledescription": "卡片流",
      "aria-label": `${widgetTitle(widget, context)}，左右方向键切换`
    },
    vertical ? /* @__PURE__ */ React5.createElement("div", { className: "sy-s-lab", style: { marginBottom: 8 } }, /* @__PURE__ */ React5.createElement(WidgetIcon, { type: "subscription", size: 16 }), widgetTitle(widget, context)) : null,
    vertical ? /* @__PURE__ */ React5.createElement("div", { className: `sy-segs${settings.auto ? " auto" : ""}` }, list.map((_, i) => /* @__PURE__ */ React5.createElement("i", { key: i, className: i < at ? "done" : i === at ? "run" : "" }))) : null,
    /* @__PURE__ */ React5.createElement("div", { className: "sy-dk-stage" }, list.map((item, position) => {
      const pos = position < at ? "past" : position === at ? "cur" : position === at + 1 ? "n1" : position === at + 2 ? "n2" : "hide";
      if (settings.pres === "论文") {
        return /* @__PURE__ */ React5.createElement(
          "article",
          {
            key: item.id,
            "data-pos": pos,
            className: `sy-dk-card paper${flipped ? " flipped" : ""}`,
            "data-k": position,
            "data-item": item.id
          },
          /* @__PURE__ */ React5.createElement("div", { className: "sy-flip" }, /* @__PURE__ */ React5.createElement("div", { className: "face front" }, /* @__PURE__ */ React5.createElement("div", { className: "sy-dk-art paper" }), /* @__PURE__ */ React5.createElement("div", { className: "sy-dk-big" }, "#", position + 1), /* @__PURE__ */ React5.createElement("div", { className: "sy-dk-in" }, /* @__PURE__ */ React5.createElement("div", { className: "sy-dk-top" }, /* @__PURE__ */ React5.createElement("span", { className: "sy-dk-src" }, "HF 论文 · #", position + 1), /* @__PURE__ */ React5.createElement(UpvotesBadge, { item }), /* @__PURE__ */ React5.createElement("span", { className: "sy-dk-time" }, item.metrics?.comments ?? 0, " 条讨论")), /* @__PURE__ */ React5.createElement("div", { className: "sy-dk-main" }, /* @__PURE__ */ React5.createElement(ItemLink, { item, className: "sy-dk-title c2" }, item.title), item.tldr ? /* @__PURE__ */ React5.createElement("p", { className: "sy-dk-sum tl c3" }, item.tldr) : null, big ? /* @__PURE__ */ React5.createElement(KeywordChips, { item, count: 4, interests: context.interests }) : null, big ? /* @__PURE__ */ React5.createElement("span", { className: "sy-dk-hint" }, /* @__PURE__ */ React5.createElement(SvgIcon, { svg: I.reset }), " 点卡片翻面看摘要") : null))), /* @__PURE__ */ React5.createElement("div", { className: "face back" }, /* @__PURE__ */ React5.createElement("div", { className: "sy-dk-in" }, /* @__PURE__ */ React5.createElement("div", { className: "sy-dk-top" }, /* @__PURE__ */ React5.createElement("span", { className: "sy-dk-src" }, "摘要"), /* @__PURE__ */ React5.createElement("span", { className: "grow" }), /* @__PURE__ */ React5.createElement("span", { className: "sy-dk-time" }, authorsLine(item))), /* @__PURE__ */ React5.createElement("p", { className: "sy-dk-abs c8" }, item.summary || item.tldr || ""), big ? /* @__PURE__ */ React5.createElement(PaperLinks, { item }) : null)))
        );
      }
      if (vertical || settings.pres === "榜单") {
        return /* @__PURE__ */ React5.createElement(
          "article",
          {
            key: item.id,
            "data-pos": pos,
            className: "sy-dk-card hot",
            "data-k": position,
            "data-item": item.id
          },
          /* @__PURE__ */ React5.createElement("div", { className: "sy-dk-in" }, /* @__PURE__ */ React5.createElement("div", { className: "sy-hot-l" }, /* @__PURE__ */ React5.createElement("span", { className: "sy-hot-n" }, item.metrics?.rank ?? position + 1), /* @__PURE__ */ React5.createElement("span", { className: "sy-dk-time" }, relTime(item.publishedAt))), /* @__PURE__ */ React5.createElement(ItemLink, { item, className: "sy-dk-title c3" }, item.title), /* @__PURE__ */ React5.createElement("div", { className: "sy-hot-m" }, /* @__PURE__ */ React5.createElement("span", { className: "sy-heat wide" }, /* @__PURE__ */ React5.createElement("i", { style: { width: `${Math.round((item.metrics?.signalCount ?? 0) / max * 100)}%` } })), /* @__PURE__ */ React5.createElement("span", null, item.origin ?? "")))
        );
      }
      const cover = coverOf(item);
      const colour = (item.category ? CATEGORY_COLOUR[item.category] : void 0) ?? "var(--sy-t-subscription)";
      return /* @__PURE__ */ React5.createElement(
        "article",
        {
          key: item.id,
          "data-pos": pos,
          className: `sy-dk-card news${cover ? " sy-on-photo" : ""}`,
          "data-k": position,
          "data-item": item.id,
          style: { "--c": colour }
        },
        cover ? /* @__PURE__ */ React5.createElement("div", { className: "sy-dk-bg" }, /* @__PURE__ */ React5.createElement("img", { src: cover, alt: "" })) : /* @__PURE__ */ React5.createElement(React5.Fragment, null, /* @__PURE__ */ React5.createElement("div", { className: "sy-dk-art" }), typeof item.score === "number" ? /* @__PURE__ */ React5.createElement("div", { className: "sy-dk-big" }, item.score) : null),
        /* @__PURE__ */ React5.createElement("div", { className: "sy-dk-in" }, /* @__PURE__ */ React5.createElement("div", { className: "sy-dk-top" }, /* @__PURE__ */ React5.createElement("span", { className: "sy-dk-src" }, item.sourceLabel ?? ""), /* @__PURE__ */ React5.createElement(CategoryBadge, { item }), /* @__PURE__ */ React5.createElement(MatchChip, { item, interests: context.interests }), /* @__PURE__ */ React5.createElement("span", { className: "grow" }), /* @__PURE__ */ React5.createElement("span", { className: "sy-dk-time" }, relTime(item.publishedAt))), /* @__PURE__ */ React5.createElement("div", { className: "sy-dk-main" }, big && cover ? /* @__PURE__ */ React5.createElement(ScoreBadge, { item }) : null, /* @__PURE__ */ React5.createElement(ItemLink, { item, className: `sy-dk-title c2${big ? " lg" : ""}` }, item.title), big && item.reason ? /* @__PURE__ */ React5.createElement("p", { className: "sy-dk-sum c2" }, item.reason) : null, big ? /* @__PURE__ */ React5.createElement("span", { className: "sy-dk-meta c1" }, item.origin ?? "") : null))
      );
    }), size === "M" ? /* @__PURE__ */ React5.createElement(React5.Fragment, null, /* @__PURE__ */ React5.createElement("button", { className: "sy-dk-arrow l", "data-act": "dk-prev", "data-w": widget.id, "aria-label": "上一条" }, "‹"), /* @__PURE__ */ React5.createElement("button", { className: "sy-dk-arrow r", "data-act": "dk-next", "data-w": widget.id, "aria-label": "下一条" }, "›")) : null),
    size === "L" || size === "Wide" ? /* @__PURE__ */ React5.createElement("div", { className: "sy-ctl" }, /* @__PURE__ */ React5.createElement("button", { className: "sy-nav", "data-act": "dk-prev", "data-w": widget.id, "aria-label": "上一条" }, "‹"), /* @__PURE__ */ React5.createElement("div", { className: "sy-dots" }, list.map((_, i) => /* @__PURE__ */ React5.createElement("i", { key: i, className: i === at ? "on" : i < at ? "done" : "" }))), /* @__PURE__ */ React5.createElement("button", { className: "sy-nav", "data-act": "dk-next", "data-w": widget.id, "aria-label": "下一条" }, "›"), /* @__PURE__ */ React5.createElement("span", { className: "sy-tip" }, "拖动卡片：右滑稍后读，左滑跳过"), /* @__PURE__ */ React5.createElement("span", { className: "grow" }), settings.pres === "论文" ? /* @__PURE__ */ React5.createElement("button", { className: "sy-dk-b", "data-act": "dk-flip", "data-w": widget.id }, /* @__PURE__ */ React5.createElement(SvgIcon, { svg: I.reset }), "翻面") : /* @__PURE__ */ React5.createElement("button", { className: "sy-dk-b", "data-act": "dk-task", "data-w": widget.id }, /* @__PURE__ */ React5.createElement(SvgIcon, { svg: I.toTask }), "转为任务"), /* @__PURE__ */ React5.createElement("button", { className: "sy-dk-b pri", "data-act": "dk-later", "data-w": widget.id }, /* @__PURE__ */ React5.createElement(SvgIcon, { svg: I.bookmark }), "稍后读")) : null
  );
}
function SubscriptionWidget({
  widget,
  size,
  settings,
  context
}) {
  const items = subItemsOf(widget, context.items, context.interests);
  const pres = settings?.pres ?? "图文";
  const title = widgetTitle(widget, context);
  if (settings?.deck) {
    return /* @__PURE__ */ React5.createElement(
      SubscriptionDeck,
      {
        widget: { ...widget, settings: { ...settings, pres } },
        size,
        items,
        context
      }
    );
  }
  if (items.length === 0) {
    return /* @__PURE__ */ React5.createElement(EmptyWidgetState, { widget, size, context });
  }
  const max = heatMax(items);
  if (pres === "视频") {
    const episodes = items.filter((item) => !isShort(item));
    const shorts = items.filter(isShort);
    const lead2 = episodes[0] ?? items[0];
    const rest = shorts.filter((item) => item !== lead2);
    if (size === "S") {
      return /* @__PURE__ */ React5.createElement(React5.Fragment, null, /* @__PURE__ */ React5.createElement("div", { className: "sy-s-lab" }, isShort(lead2) ? "Shorts" : "最新节目", " · ", title), /* @__PURE__ */ React5.createElement("div", null, /* @__PURE__ */ React5.createElement(ItemLink, { item: lead2, className: "sy-s-title c2" }, lead2.title), /* @__PURE__ */ React5.createElement("div", { className: "meta", style: { marginTop: 4 } }, videoMeta(lead2))), /* @__PURE__ */ React5.createElement(ItemActions, { item: lead2, saved: context.saved.has(lead2.id) }));
    }
    const description = cleanDesc(lead2.description || lead2.summary);
    if (size === "M") {
      return /* @__PURE__ */ React5.createElement("div", { className: "sy-vm" }, /* @__PURE__ */ React5.createElement(VideoThumb, { item: lead2 }), /* @__PURE__ */ React5.createElement("div", { className: "sy-vm-t" }, /* @__PURE__ */ React5.createElement("span", { className: "mono-l" }, isShort(lead2) ? "SHORTS" : "最新节目", " · ", lead2.origin ?? ""), /* @__PURE__ */ React5.createElement(ItemLink, { item: lead2, className: "sy-lead-t c2" }, lead2.title), /* @__PURE__ */ React5.createElement("span", { className: "meta" }, videoMeta(lead2)), rest.length ? /* @__PURE__ */ React5.createElement("span", { className: "meta" }, "还有 ", rest.length, " 条 Shorts") : null));
    }
    if (size === "Wide") {
      return /* @__PURE__ */ React5.createElement("div", { className: "sy-fit-x sy-reel" }, /* @__PURE__ */ React5.createElement(EpisodeCard, { item: lead2 }), rest.map((item) => /* @__PURE__ */ React5.createElement(ShortCard, { key: item.id, item })));
    }
    return /* @__PURE__ */ React5.createElement("div", { className: "sy-vL" }, /* @__PURE__ */ React5.createElement("div", { className: "sy-vL-ep" }, /* @__PURE__ */ React5.createElement(VideoThumb, { item: lead2 }), /* @__PURE__ */ React5.createElement("div", { className: "sy-vm-t", style: { justifyContent: "flex-start" } }, /* @__PURE__ */ React5.createElement("span", { className: "mono-l" }, isShort(lead2) ? "SHORTS" : "最新节目", " · ", relTime(lead2.publishedAt)), /* @__PURE__ */ React5.createElement(ItemLink, { item: lead2, className: "sy-lead-t c2" }, lead2.title), description ? /* @__PURE__ */ React5.createElement("div", { className: "sy-reason-plain c2" }, description) : null)), rest.length ? /* @__PURE__ */ React5.createElement("div", { className: "sy-vL-sh" }, /* @__PURE__ */ React5.createElement("div", { className: "sy-agenda-h", style: { paddingTop: 0 } }, "SHORTS · ", rest.length), /* @__PURE__ */ React5.createElement("div", { className: "sy-fit sy-reel2" }, rest.map((item) => /* @__PURE__ */ React5.createElement(ShortCard, { key: item.id, item })))) : null);
  }
  if (pres === "论文") {
    const lead2 = items[0];
    if (size === "S") {
      return /* @__PURE__ */ React5.createElement(React5.Fragment, null, /* @__PURE__ */ React5.createElement("div", { className: "sy-s-lab" }, title, " · #1"), /* @__PURE__ */ React5.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 6 } }, /* @__PURE__ */ React5.createElement(UpvotesBadge, { item: lead2, className: "big" }), /* @__PURE__ */ React5.createElement(ItemLink, { item: lead2, className: "sy-s-title c3" }, lead2.title)), /* @__PURE__ */ React5.createElement(KeywordChips, { item: lead2, count: 2, interests: context.interests }));
    }
    if (size === "M") {
      return /* @__PURE__ */ React5.createElement("div", { className: "sy-m-split" }, /* @__PURE__ */ React5.createElement("div", { className: "sy-lead" }, /* @__PURE__ */ React5.createElement("div", { className: "sy-nl-top" }, /* @__PURE__ */ React5.createElement("span", { className: "mono-l" }, "#1 今日"), /* @__PURE__ */ React5.createElement(UpvotesBadge, { item: lead2 })), /* @__PURE__ */ React5.createElement(ItemLink, { item: lead2, className: "sy-lead-t c2" }, lead2.title), lead2.tldr ? /* @__PURE__ */ React5.createElement("div", { className: "meta c2", style: { whiteSpace: "normal", lineHeight: 1.45 } }, lead2.tldr) : null, /* @__PURE__ */ React5.createElement(ItemActions, { item: lead2, saved: context.saved.has(lead2.id) })), /* @__PURE__ */ React5.createElement("div", { className: "sy-list sy-fit" }, items.slice(1, 6).map((item, idx) => /* @__PURE__ */ React5.createElement(PaperRow, { key: item.id, item, index: idx + 2, withSummary: false, context }))));
    }
    if (size === "Wide") {
      return /* @__PURE__ */ React5.createElement("div", { className: "sy-fit-x", style: { gap: 12 } }, items.slice(0, 8).map((item, idx) => /* @__PURE__ */ React5.createElement(PaperCard, { key: item.id, item, index: idx, context })));
    }
    return /* @__PURE__ */ React5.createElement(React5.Fragment, null, /* @__PURE__ */ React5.createElement(PaperLead, { item: lead2, context }), /* @__PURE__ */ React5.createElement("div", { className: "sy-list sy-fit" }, items.slice(1, 8).map((item, idx) => /* @__PURE__ */ React5.createElement(PaperRow, { key: item.id, item, index: idx + 2, withSummary: true, context }))));
  }
  if (pres === "榜单") {
    if (size === "S") {
      return /* @__PURE__ */ React5.createElement(React5.Fragment, null, /* @__PURE__ */ React5.createElement("div", { className: "sy-s-lab" }, /* @__PURE__ */ React5.createElement(WidgetIcon, { type: "subscription", size: 16 }), title), /* @__PURE__ */ React5.createElement("div", { className: "sy-list sy-fit", style: { marginTop: 8 } }, items.slice(0, 5).map((item, idx) => /* @__PURE__ */ React5.createElement(RankRow, { key: item.id, item, index: idx, max }))));
    }
    if (size === "M") {
      return /* @__PURE__ */ React5.createElement("div", { className: "sy-grid2 r3" }, items.slice(0, 6).map((item, idx) => /* @__PURE__ */ React5.createElement(RankRow, { key: item.id, item, index: idx, max })));
    }
    if (size === "Wide") {
      return /* @__PURE__ */ React5.createElement(
        "div",
        {
          className: "sy-grid2 r3",
          style: { gridTemplateColumns: "repeat(3,minmax(0,1fr))", gridTemplateRows: "repeat(4,auto)" }
        },
        items.slice(0, 12).map((item, idx) => /* @__PURE__ */ React5.createElement(RankRow, { key: item.id, item, index: idx, max }))
      );
    }
    return /* @__PURE__ */ React5.createElement("div", { className: "sy-list sy-fit" }, items.slice(0, 10).map((item, idx) => /* @__PURE__ */ React5.createElement(RankRow, { key: item.id, item, index: idx, max })));
  }
  if (pres === "产品") {
    const lead2 = items[0];
    if (size === "S") {
      return /* @__PURE__ */ React5.createElement(React5.Fragment, null, /* @__PURE__ */ React5.createElement("div", { className: "sy-s-lab" }, title), /* @__PURE__ */ React5.createElement("div", { className: "sy-s-narrow", style: { display: "flex", flexDirection: "column", gap: 6 } }, /* @__PURE__ */ React5.createElement(MonoTile, { name: lead2.title }), /* @__PURE__ */ React5.createElement(ItemLink, { item: lead2, className: "sy-s-title c1" }, lead2.title), /* @__PURE__ */ React5.createElement("div", { className: "meta c2", style: { whiteSpace: "normal" } }, lead2.summary ?? "")));
    }
    if (size === "M") {
      return /* @__PURE__ */ React5.createElement("div", { className: "sy-grid2", style: { rowGap: 4 } }, items.slice(0, 4).map((item) => /* @__PURE__ */ React5.createElement(ProdRow, { key: item.id, item, context })));
    }
    if (size === "Wide") {
      return /* @__PURE__ */ React5.createElement("div", { className: "sy-fit-x", style: { gap: 12 } }, items.slice(0, 8).map((item) => /* @__PURE__ */ React5.createElement(ProdCard, { key: item.id, item, context })));
    }
    return /* @__PURE__ */ React5.createElement("div", { className: "sy-list sy-fit" }, items.slice(0, 9).map((item) => /* @__PURE__ */ React5.createElement(ProdRow, { key: item.id, item, context })));
  }
  const lead = items[0];
  if (size === "S") {
    if (coverOf(lead)) {
      return /* @__PURE__ */ React5.createElement(React5.Fragment, null, /* @__PURE__ */ React5.createElement("div", { className: "sy-s-lab" }, title), /* @__PURE__ */ React5.createElement("div", null, /* @__PURE__ */ React5.createElement(ItemLink, { item: lead, className: "sy-s-title c3" }, lead.title), /* @__PURE__ */ React5.createElement("div", { className: "meta", style: { marginTop: 4 } }, metaLine(lead))), /* @__PURE__ */ React5.createElement(ItemActions, { item: lead, saved: context.saved.has(lead.id) }));
    }
    return /* @__PURE__ */ React5.createElement(React5.Fragment, null, /* @__PURE__ */ React5.createElement("div", { className: "sy-s-lab" }, title), /* @__PURE__ */ React5.createElement("div", { className: "sy-s-narrow" }, /* @__PURE__ */ React5.createElement("div", { className: "sy-nl-top", style: { marginBottom: 6 } }, /* @__PURE__ */ React5.createElement(ScoreBadge, { item: lead }), /* @__PURE__ */ React5.createElement(MatchChip, { item: lead, interests: context.interests })), /* @__PURE__ */ React5.createElement(ItemLink, { item: lead, className: "sy-s-title c3" }, lead.title)), /* @__PURE__ */ React5.createElement("div", { className: "meta" }, relTime(lead.publishedAt)));
  }
  if (size === "M") {
    return /* @__PURE__ */ React5.createElement("div", { className: "sy-m-split" }, /* @__PURE__ */ React5.createElement(NewsLead, { item: lead, context, big: false }), /* @__PURE__ */ React5.createElement("div", { className: "sy-list sy-fit" }, items.slice(1, 6).map((item) => /* @__PURE__ */ React5.createElement(NewsRow, { key: item.id, item, context }))));
  }
  if (size === "Wide") {
    return /* @__PURE__ */ React5.createElement("div", { className: "sy-fit-x", style: { gap: 12 } }, items.slice(0, 8).map((item) => /* @__PURE__ */ React5.createElement(NewsCard, { key: item.id, item, context })));
  }
  return /* @__PURE__ */ React5.createElement(React5.Fragment, null, /* @__PURE__ */ React5.createElement(CategoryTabs, { widget, context }), /* @__PURE__ */ React5.createElement(NewsLead, { item: lead, context, big: true }), /* @__PURE__ */ React5.createElement("div", { className: "sy-list sy-fit" }, items.slice(1, 10).map((item) => /* @__PURE__ */ React5.createElement(NewsRow, { key: item.id, item, context }))));
}
var subscriptionWidgetDefinition = {
  type: "subscription",
  name: "订阅",
  desc: "一个或多个来源的最新内容",
  priority: "P0",
  sizes: { S: [3, 2], M: [6, 2], L: [6, 4], Wide: [12, 3] },
  defaultSize: "M",
  actions: ["稍后读", "转为任务", "打开原文"],
  defaultSettings: () => ({
    sources: ["aihot"],
    pres: "图文",
    sort: "new",
    deck: false,
    auto: false,
    cat: null
  }),
  normalizeSettings: (raw) => {
    const obj = raw && typeof raw === "object" ? raw : {};
    const sources = Array.isArray(obj.sources) && obj.sources.length > 0 ? obj.sources.map(String) : ["aihot"];
    const pres = ["图文", "榜单", "论文", "产品", "视频"].includes(obj.pres) ? obj.pres : "图文";
    const sort = ["match", "new", "score", "rank"].includes(obj.sort) ? obj.sort : "new";
    return {
      sources,
      pres,
      sort,
      deck: Boolean(obj.deck),
      auto: Boolean(obj.auto),
      cat: typeof obj.cat === "string" && obj.cat ? obj.cat : null
    };
  },
  Component: SubscriptionWidget,
  computeLayoutMeta: ({ widget, size, settings, context }) => {
    const items = subItemsOf(widget, context.items, context.interests);
    const pres = settings?.pres ?? "图文";
    const matches = items.filter((item) => matchOf(item, context.interests)).length;
    const sub = `${items.length} 条${matches ? ` · ${matches} 条命中关注` : ""}`;
    if (settings?.deck) {
      const vertical = size === "S";
      const list = items.slice(0, DECK_SIZE);
      if (list.length === 0) return { sub, noHeader: vertical };
      return { sub, noHeader: vertical, cls: " sy-w-deck" };
    }
    if (items.length === 0) return { sub: "空" };
    if (pres === "视频") {
      const episodes = items.filter((item) => !isShort(item));
      const lead2 = episodes[0] ?? items[0];
      if (size === "S") {
        const cover = coverOf(lead2);
        return {
          cls: cover ? "sy-w--photo" : "",
          bg: cover ? /* @__PURE__ */ React5.createElement("div", { className: "bgimg" }, /* @__PURE__ */ React5.createElement("img", { src: cover, alt: "" })) : void 0
        };
      }
      return { sub };
    }
    if (pres === "产品") {
      if (size === "S") return { deco: "subscription" };
      return { sub };
    }
    if (pres === "论文" || pres === "榜单") {
      if (size === "S") return {};
      return { sub };
    }
    const lead = items[0];
    if (size === "S") {
      const cover = coverOf(lead);
      if (cover) {
        return {
          cls: "sy-w--photo",
          bg: /* @__PURE__ */ React5.createElement("div", { className: "bgimg" }, /* @__PURE__ */ React5.createElement("img", { src: cover, alt: "" }))
        };
      }
      return { deco: "subscription" };
    }
    return { sub };
  }
};

// src/client/widgets/capture/CaptureWidget.tsx
var React6 = __toESM(require("react"), 1);
function CaptureWidget({ widget, size, context }) {
  const form = /* @__PURE__ */ React6.createElement("form", { className: "sy-cap", "data-form": "capture", "data-w": widget.id }, /* @__PURE__ */ React6.createElement("input", { name: "t", placeholder: "记下一个想法…", autoComplete: "off", "aria-label": "快速记录" }), /* @__PURE__ */ React6.createElement("kbd", null, "↵"));
  const hint = /* @__PURE__ */ React6.createElement("div", { className: "sy-cap-hint" }, "回车存进收件箱 · 以 ", /* @__PURE__ */ React6.createElement("code", null, "#note"), " 开头存为 Note");
  const recent = context.notes.slice(0, 6).map((note) => /* @__PURE__ */ React6.createElement("div", { key: note.id, className: "sy-row", style: { minHeight: 28 } }, /* @__PURE__ */ React6.createElement("span", { className: "sy-kind note" }, "Note"), /* @__PURE__ */ React6.createElement("span", { className: "c1 grow", style: { fontSize: 13 } }, note.text), /* @__PURE__ */ React6.createElement("span", { className: "meta" }, relTime(note.createdAt)), /* @__PURE__ */ React6.createElement("button", { className: "sy-mini", "data-act": "note-remove", "data-note": note.id, "aria-label": "删除", title: "删除" }, /* @__PURE__ */ React6.createElement(SvgIcon, { svg: I.x }))));
  if (size === "Wide") {
    return /* @__PURE__ */ React6.createElement("div", { className: "sy-cap-wide" }, /* @__PURE__ */ React6.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 8 } }, form, hint), /* @__PURE__ */ React6.createElement("div", { className: "sy-list sy-fit", style: { alignSelf: "stretch" } }, recent));
  }
  return /* @__PURE__ */ React6.createElement(React6.Fragment, null, form, /* @__PURE__ */ React6.createElement("div", { className: "sy-list sy-fit" }, recent));
}
var captureWidgetDefinition = {
  type: "capture",
  name: "快速记录",
  desc: "一行记下想法，回车存进收件箱",
  priority: "P0",
  sizes: { M: [6, 2], Wide: [12, 2] },
  defaultSize: "M",
  actions: ["记一条任务", "记一条 Note"],
  defaultSettings: () => ({}),
  normalizeSettings: () => ({}),
  Component: CaptureWidget,
  computeLayoutMeta: ({ context }) => {
    const inbox = context.tasks.filter((task) => task.list === "inbox").length;
    return { sub: `收件箱 ${inbox}` };
  }
};

// src/client/widgets/notes/NoteWidget.tsx
var React7 = __toESM(require("react"), 1);
function NoteWidget({ widget, size, context }) {
  const notes = context.notes ?? [];
  if (notes.length === 0) {
    return /* @__PURE__ */ React7.createElement(EmptyWidgetState, { widget, size, context });
  }
  if (size === "S") {
    const first = notes[0];
    return /* @__PURE__ */ React7.createElement(React7.Fragment, null, /* @__PURE__ */ React7.createElement("div", { className: "sy-s-lab" }, "随手记"), /* @__PURE__ */ React7.createElement("div", { className: "sy-s-main" }, /* @__PURE__ */ React7.createElement("div", { className: "sy-s-big" }, notes.length), /* @__PURE__ */ React7.createElement("div", { className: "sy-s-sub" }, "条笔记")), /* @__PURE__ */ React7.createElement("div", { className: "sy-s-narrow" }, /* @__PURE__ */ React7.createElement("span", { className: "c1", style: { fontSize: 13 } }, first.text)));
  }
  return /* @__PURE__ */ React7.createElement("div", { className: "sy-list sy-fit", style: { gap: 4 } }, notes.slice(0, size === "L" ? 10 : 5).map((note) => /* @__PURE__ */ React7.createElement("div", { key: note.id, className: "sy-row" }, /* @__PURE__ */ React7.createElement("span", { className: "sy-kind note" }, "Note"), /* @__PURE__ */ React7.createElement("span", { className: "c1 grow", style: { fontSize: 13.5 } }, note.text), note.origin?.url ? /* @__PURE__ */ React7.createElement(
    "a",
    {
      className: "sy-chip",
      href: safeUrl(note.origin.url),
      target: "_blank",
      rel: "noopener noreferrer",
      title: `来自 ${note.origin.source ?? ""}`
    },
    note.origin.source ?? "原文"
  ) : null, /* @__PURE__ */ React7.createElement("span", { className: "meta" }, relTime(note.createdAt)), /* @__PURE__ */ React7.createElement("button", { className: "sy-mini", "data-act": "note-remove", "data-note": note.id, "aria-label": "删除", title: "删除" }, /* @__PURE__ */ React7.createElement(SvgIcon, { svg: I.x })))));
}
var noteWidgetDefinition = {
  type: "notes",
  name: "笔记",
  desc: "你存下来的随手记与阅读摘录",
  priority: "P1",
  sizes: { S: [3, 2], M: [6, 2], L: [6, 4] },
  defaultSize: "M",
  actions: ["查看笔记", "删除笔记"],
  defaultSettings: () => ({}),
  normalizeSettings: () => ({}),
  Component: NoteWidget,
  computeLayoutMeta: ({ context }) => ({
    sub: context.notes.length ? `${context.notes.length} 条` : "空"
  })
};

// src/client/widgets/bookmarks/BookmarksWidget.tsx
var React8 = __toESM(require("react"), 1);
function BookmarksWidget({ widget, size, context }) {
  const rows = context.bookmarks ?? [];
  if (rows.length === 0) {
    return /* @__PURE__ */ React8.createElement(EmptyWidgetState, { widget, size, context });
  }
  if (size === "S") {
    return /* @__PURE__ */ React8.createElement("div", { className: "sy-bm-s" }, rows.slice(0, 6).map((entry) => /* @__PURE__ */ React8.createElement(
      "a",
      {
        key: `${entry.name}:${entry.url}`,
        className: "sy-bm-tile",
        href: safeUrl(entry.url),
        target: "_blank",
        rel: "noopener noreferrer"
      },
      /* @__PURE__ */ React8.createElement(MonoTile, { name: entry.name }),
      /* @__PURE__ */ React8.createElement("span", null, entry.name)
    )));
  }
  const count = size === "Wide" ? context.cols >= 12 ? 12 : 8 : 8;
  const columns = size === "Wide" ? context.cols >= 12 ? 6 : 4 : context.cols >= 6 ? 4 : 2;
  const limit = context.cols <= 4 ? 4 : count;
  return /* @__PURE__ */ React8.createElement("div", { className: "sy-bm-grid", style: { gridTemplateColumns: `repeat(${columns},minmax(0,1fr))` } }, rows.slice(0, limit).map((entry) => /* @__PURE__ */ React8.createElement(
    "a",
    {
      key: `${entry.name}:${entry.url}`,
      className: "sy-bm-chip",
      href: safeUrl(entry.url),
      target: "_blank",
      rel: "noopener noreferrer"
    },
    /* @__PURE__ */ React8.createElement(MonoTile, { name: entry.name }),
    /* @__PURE__ */ React8.createElement("span", null, entry.name)
  )));
}
var bookmarksWidgetDefinition = {
  type: "bookmarks",
  name: "书签",
  desc: "常去的网站一键直达",
  priority: "P0",
  sizes: { S: [3, 2], M: [6, 2], Wide: [12, 2] },
  defaultSize: "S",
  actions: ["打开链接"],
  defaultSettings: () => ({}),
  normalizeSettings: () => ({}),
  Component: BookmarksWidget,
  computeLayoutMeta: ({ size, context }) => {
    const rows = context.bookmarks ?? [];
    if (rows.length === 0 || size === "S") return {};
    return { sub: `${rows.length} 个` };
  }
};

// src/client/widgets/project/ProjectWidget.tsx
var React9 = __toESM(require("react"), 1);
var colourOf = (name) => ["var(--sy-t-project)", "var(--sy-t-task)", "var(--sy-t-bookmarks)", "var(--sy-t-habit)"][hueOf(name) % 4];
function ProjectWidget({ widget, size, context }) {
  const projects = projectsOf(context.tasks);
  if (projects.length === 0) {
    return /* @__PURE__ */ React9.createElement(EmptyWidgetState, { widget, size, context });
  }
  if (size === "S") {
    const project = projects[0];
    return /* @__PURE__ */ React9.createElement(React9.Fragment, null, /* @__PURE__ */ React9.createElement("div", { className: "sy-s-lab" }, /* @__PURE__ */ React9.createElement(WidgetIcon, { type: "project", size: 16 }), "项目"), /* @__PURE__ */ React9.createElement("div", { className: "sy-pj-s" }, /* @__PURE__ */ React9.createElement(
      ProgressRing,
      {
        pct: project.progress,
        size: 60,
        stroke: 7,
        colour: colourOf(project.name),
        label: `${Math.round(project.progress * 100)}%`
      }
    ), /* @__PURE__ */ React9.createElement("div", { style: { minWidth: 0 } }, /* @__PURE__ */ React9.createElement("div", { style: { fontWeight: 600, fontSize: 15 }, className: "c1" }, project.name), /* @__PURE__ */ React9.createElement("div", { className: "meta" }, project.open, " 件待办"))), /* @__PURE__ */ React9.createElement("div", { className: "meta c1", style: { whiteSpace: "normal" } }, projects.length, " 个项目在推进"));
  }
  const rows = projects.map((project) => /* @__PURE__ */ React9.createElement("div", { key: project.name, className: "sy-pj-row" }, /* @__PURE__ */ React9.createElement("div", { className: "sy-pj-h" }, /* @__PURE__ */ React9.createElement("span", { className: "sy-pj-dot", style: { "--c": colourOf(project.name) } }), /* @__PURE__ */ React9.createElement("b", { className: "c1" }, project.name), /* @__PURE__ */ React9.createElement("span", { className: "grow" }), /* @__PURE__ */ React9.createElement("span", { className: "meta" }, Math.round(project.progress * 100), "% · ", project.open, " 件待办")), /* @__PURE__ */ React9.createElement(ProgressBar, { pct: project.progress, colour: colourOf(project.name) })));
  if (size === "M") {
    return /* @__PURE__ */ React9.createElement("div", { className: "sy-list sy-fit", style: { gap: 9 } }, rows);
  }
  return /* @__PURE__ */ React9.createElement(React9.Fragment, null, /* @__PURE__ */ React9.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 11, flex: "none" } }, rows), /* @__PURE__ */ React9.createElement("div", { className: "sy-agenda-h" }, "最近完成"), /* @__PURE__ */ React9.createElement("div", { className: "sy-list sy-fit", style: { gap: 3 } }, context.tasks.filter((task) => task.done).slice(0, 6).map((task) => /* @__PURE__ */ React9.createElement("div", { key: task.id, className: "sy-row", style: { minHeight: 28 } }, /* @__PURE__ */ React9.createElement("span", { className: "sy-chk sy-done" }, /* @__PURE__ */ React9.createElement(SvgIcon, { svg: I.check })), /* @__PURE__ */ React9.createElement("span", { className: "tt c1 grow" }, task.title), /* @__PURE__ */ React9.createElement("span", { className: "meta" }, task.project ?? "")))));
}
var projectWidgetDefinition = {
  type: "project",
  name: "项目",
  desc: "按任务完成度看每个 Project 的进度",
  priority: "P0",
  sizes: { S: [3, 2], M: [6, 2], L: [6, 4] },
  defaultSize: "S",
  actions: ["查看动态"],
  defaultSettings: () => ({}),
  normalizeSettings: () => ({}),
  Component: ProjectWidget,
  computeLayoutMeta: ({ size, context }) => {
    const projects = projectsOf(context.tasks);
    if (projects.length === 0) return { sub: "空" };
    if (size === "S") return {};
    return { sub: `${projects.length} 个进行中` };
  }
};

// src/client/widgets/readlater/ReadLaterWidget.tsx
var React10 = __toESM(require("react"), 1);
function resolveReadLaterItems(context) {
  return context.readLater.map((id) => context.byId.get(id) ?? context.readLaterEntries?.[id]).filter((item) => Boolean(item));
}
function ReadLaterActions({ item }) {
  return /* @__PURE__ */ React10.createElement("span", { className: "sy-acts" }, /* @__PURE__ */ React10.createElement("button", { "data-act": "rl-note", "data-item": item.id, title: "转为 Note", "aria-label": "转为 Note" }, /* @__PURE__ */ React10.createElement(SvgIcon, { svg: I.note })), /* @__PURE__ */ React10.createElement("button", { "data-act": "item-task", "data-item": item.id, title: "转为任务", "aria-label": "转为任务" }, /* @__PURE__ */ React10.createElement(SvgIcon, { svg: I.toTask })), /* @__PURE__ */ React10.createElement("button", { "data-act": "item-later", "data-item": item.id, "data-off": "1", title: "移出稍后读", "aria-label": "移出稍后读" }, /* @__PURE__ */ React10.createElement(SvgIcon, { svg: I.x })));
}
function ReadLaterWidget({ widget, size, context }) {
  const items = resolveReadLaterItems(context);
  if (items.length === 0) {
    return /* @__PURE__ */ React10.createElement(EmptyWidgetState, { widget, size, context });
  }
  const first = items[0];
  if (size === "S") {
    return /* @__PURE__ */ React10.createElement(React10.Fragment, null, /* @__PURE__ */ React10.createElement("div", { className: "sy-s-lab" }, "稍后读"), /* @__PURE__ */ React10.createElement("div", { className: "sy-s-main" }, /* @__PURE__ */ React10.createElement("div", { className: "sy-s-big" }, items.length), /* @__PURE__ */ React10.createElement("div", { className: "sy-s-sub" }, "篇等你读")), /* @__PURE__ */ React10.createElement("div", { className: "sy-s-narrow" }, /* @__PURE__ */ React10.createElement(ItemLink, { item: first, className: "c1" }, /* @__PURE__ */ React10.createElement("span", { style: { fontSize: 13 } }, first.title))));
  }
  if (size === "M") {
    return /* @__PURE__ */ React10.createElement("div", { className: "sy-list sy-fit" }, items.map((item) => /* @__PURE__ */ React10.createElement("div", { key: item.id, className: "sy-row" }, /* @__PURE__ */ React10.createElement(ItemLink, { item, className: "sy-it-a" }, /* @__PURE__ */ React10.createElement("span", { className: "tt c1" }, item.title), /* @__PURE__ */ React10.createElement("span", { className: "meta" }, item.sourceLabel ?? "", " · ", relTime(item.publishedAt))), /* @__PURE__ */ React10.createElement(ReadLaterActions, { item }))));
  }
  return /* @__PURE__ */ React10.createElement(React10.Fragment, null, /* @__PURE__ */ React10.createElement("div", { className: "sy-list sy-fit", style: { gap: 3 } }, items.map((item) => /* @__PURE__ */ React10.createElement("div", { key: item.id, className: "sy-row", style: { gap: 12 } }, /* @__PURE__ */ React10.createElement("div", { className: "sy-thumb", style: { width: 68, height: 42 } }, /* @__PURE__ */ React10.createElement(ThumbBox, { item, label: item.sourceLabel ?? void 0 })), /* @__PURE__ */ React10.createElement(ItemLink, { item, className: "sy-it-a" }, /* @__PURE__ */ React10.createElement("span", { className: "tt c2" }, item.title), /* @__PURE__ */ React10.createElement("span", { className: "meta" }, item.sourceLabel ?? "", " · ", relTime(item.publishedAt))), /* @__PURE__ */ React10.createElement(ReadLaterActions, { item })))), /* @__PURE__ */ React10.createElement("div", { className: "meta", style: { flex: "none" } }, "在订阅里点书签图标，文章就会存到这里"));
}
var readLaterWidgetDefinition = {
  type: "readlater",
  name: "稍后读",
  desc: "存下来、晚点再读的文章",
  priority: "P0",
  sizes: { S: [3, 2], M: [6, 2], L: [6, 4] },
  defaultSize: "M",
  actions: ["转为 Note", "转为任务", "移出"],
  defaultSettings: () => ({}),
  normalizeSettings: () => ({}),
  Component: ReadLaterWidget,
  computeLayoutMeta: ({ size, context }) => {
    const items = resolveReadLaterItems(context);
    if (items.length === 0) return { sub: "空" };
    if (size === "S") return { deco: "ill-readlater" };
    return { sub: `${items.length} 篇` };
  }
};

// src/client/widgets/habit/HabitWidget.tsx
var React11 = __toESM(require("react"), 1);
function Dots7({ habit }) {
  const week = habit.week ?? [0, 0, 0, 0, 0, 0, 0];
  const todayIndex = dayIdx();
  return /* @__PURE__ */ React11.createElement("div", { className: "sy-dots7" }, week.map(
    (value, index) => index === todayIndex ? /* @__PURE__ */ React11.createElement(
      "button",
      {
        key: index,
        className: `${value ? "on" : ""} today`.trim(),
        "data-act": "habit-tick",
        "data-habit": habit.id,
        "aria-label": `今天${value ? "已打卡，点击取消" : "打卡"}：${habit.name}`
      },
      value ? /* @__PURE__ */ React11.createElement(SvgIcon, { svg: I.check }) : null
    ) : /* @__PURE__ */ React11.createElement(
      "span",
      {
        key: index,
        className: index > todayIndex ? "future" : value ? "on" : "",
        "aria-hidden": "true"
      },
      "一二三四五六日"[index]
    )
  ));
}
function HabitWidget({ widget, size, context }) {
  const habits = context.habits ?? [];
  if (habits.length === 0) {
    return /* @__PURE__ */ React11.createElement(EmptyWidgetState, { widget, size, context });
  }
  if (size === "S") {
    const habit = habits[0];
    return /* @__PURE__ */ React11.createElement(React11.Fragment, null, /* @__PURE__ */ React11.createElement("div", { className: "sy-s-lab" }, /* @__PURE__ */ React11.createElement(WidgetIcon, { type: "habit", size: 16 }), habit.name), /* @__PURE__ */ React11.createElement("div", { className: "sy-s-main" }, /* @__PURE__ */ React11.createElement("div", { className: "sy-s-big" }, habit.streak ?? 0, /* @__PURE__ */ React11.createElement("small", null, "天")), /* @__PURE__ */ React11.createElement("div", { className: "sy-s-sub" }, "连续打卡")), /* @__PURE__ */ React11.createElement(Dots7, { habit }));
  }
  return /* @__PURE__ */ React11.createElement("div", { className: "sy-list sy-fit", style: { gap: 3 } }, habits.map((habit) => /* @__PURE__ */ React11.createElement("div", { key: habit.id, className: "sy-hb-row" }, /* @__PURE__ */ React11.createElement("span", { className: "c1 grow", style: { fontSize: 13.5, fontWeight: 500 } }, habit.name), /* @__PURE__ */ React11.createElement("span", { className: "meta" }, habit.streak ?? 0, " 天"), /* @__PURE__ */ React11.createElement(Dots7, { habit }))));
}
var habitWidgetDefinition = {
  type: "habit",
  name: "习惯打卡",
  desc: "每天点一下，看这周做到了几天",
  priority: "P1",
  sizes: { S: [3, 2], M: [6, 2] },
  defaultSize: "M",
  actions: ["今日打卡"],
  defaultSettings: () => ({}),
  normalizeSettings: () => ({}),
  Component: HabitWidget,
  computeLayoutMeta: ({ size, context }) => {
    const habits = context.habits ?? [];
    if (habits.length === 0) return { sub: "空" };
    if (size === "S") return {};
    const today = habits.filter((habit) => habit.week?.[dayIdx()]).length;
    return { sub: `今天 ${today}/${habits.length}` };
  }
};

// src/client/widgets/focus/FocusWidget.tsx
var React12 = __toESM(require("react"), 1);
var fmtClock = (seconds) => `${pad2(Math.floor(seconds / 60))}:${pad2(seconds % 60)}`;
function FocusWidget({ size, context }) {
  const focus = context.focus ?? { total: 1500, left: 1500, running: false, sessions: 0, task: null };
  const task = context.tasks.find((entry) => entry.id === focus.task);
  const button = /* @__PURE__ */ React12.createElement(
    "button",
    {
      className: "sy-play-btn",
      "data-act": "focus-toggle",
      "aria-label": focus.running ? "暂停" : "开始专注"
    },
    /* @__PURE__ */ React12.createElement(SvgIcon, { svg: focus.running ? I.pause : I.play })
  );
  if (size === "S") {
    return /* @__PURE__ */ React12.createElement(React12.Fragment, null, /* @__PURE__ */ React12.createElement("div", { className: "sy-s-lab" }, "专注 · 第 ", (focus.sessions ?? 0) + 1, " 个番茄"), /* @__PURE__ */ React12.createElement("div", { className: "sy-fx" }, /* @__PURE__ */ React12.createElement("span", { className: "sy-fd" }, fmtClock(focus.left)), button), /* @__PURE__ */ React12.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 6 } }, /* @__PURE__ */ React12.createElement(ProgressBar, { pct: 1 - focus.left / focus.total, colour: "var(--sy-t-focus)" }), /* @__PURE__ */ React12.createElement("div", { className: "meta c1", style: { whiteSpace: "normal" } }, task ? task.title : "没有关联任务")));
  }
  return /* @__PURE__ */ React12.createElement("div", { className: "sy-fm" }, /* @__PURE__ */ React12.createElement(
    ProgressRing,
    {
      pct: 1 - focus.left / focus.total,
      size: 96,
      stroke: 8,
      colour: "var(--sy-t-focus)",
      label: fmtClock(focus.left)
    }
  ), /* @__PURE__ */ React12.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 8, minWidth: 0 } }, /* @__PURE__ */ React12.createElement("div", { className: "meta" }, "当前任务"), /* @__PURE__ */ React12.createElement(
    "button",
    {
      className: "c1",
      "data-act": "focus-next-task",
      style: { textAlign: "left", fontSize: 14, fontWeight: 500 },
      title: "换一个任务"
    },
    task ? task.title : "选择一个任务",
    " ",
    /* @__PURE__ */ React12.createElement("span", { className: "meta" }, "↻")
  ), /* @__PURE__ */ React12.createElement("div", { className: "sy-sess" }, [0, 1, 2, 3].map((index) => /* @__PURE__ */ React12.createElement("i", { key: index, className: index < (focus.sessions ?? 0) ? "on" : "" }))), /* @__PURE__ */ React12.createElement("div", { style: { display: "flex", gap: 8 } }, button, /* @__PURE__ */ React12.createElement("button", { className: "sy-play-btn ghost", "data-act": "focus-reset", "aria-label": "重置" }, /* @__PURE__ */ React12.createElement(SvgIcon, { svg: I.reset })))));
}
var focusWidgetDefinition = {
  type: "focus",
  name: "番茄专注",
  desc: "25 分钟专注倒计时，关联一件今天的任务",
  priority: "P1",
  sizes: { S: [3, 2], M: [6, 2] },
  defaultSize: "S",
  actions: ["开始或暂停", "重置"],
  defaultSettings: () => ({}),
  normalizeSettings: () => ({}),
  Component: FocusWidget,
  computeLayoutMeta: ({ size, context }) => {
    if (size === "S") return {};
    const focus = context.focus ?? { sessions: 0 };
    return { sub: `今天 ${focus.sessions ?? 0} 个番茄` };
  }
};

// src/client/widgets/agent-inbox/AgentInboxWidget.tsx
var React13 = __toESM(require("react"), 1);
function ProposalRow({ proposal, actionable }) {
  return /* @__PURE__ */ React13.createElement(
    "div",
    {
      className: "sy-row",
      style: {
        alignItems: "flex-start",
        gap: 10,
        padding: "7px 0",
        marginInline: 0,
        borderBottom: "1px solid var(--sy-line)"
      }
    },
    /* @__PURE__ */ React13.createElement("div", { className: "grow", style: { minWidth: 0, display: "flex", flexDirection: "column", gap: 4 } }, /* @__PURE__ */ React13.createElement("span", { className: "c2", style: { fontSize: 13.5, fontWeight: 520 } }, proposal.reason), /* @__PURE__ */ React13.createElement("span", { style: { display: "flex", gap: 5, flexWrap: "wrap" } }, (proposal.operations ?? []).map((operation, idx) => /* @__PURE__ */ React13.createElement("span", { key: idx, className: "sy-chip", title: operation.name }, OPERATION_LABELS[operation.name] ?? operation.name))), /* @__PURE__ */ React13.createElement("span", { className: "meta" }, relTime(proposal.createdAt), (proposal.evidenceRefs ?? []).length ? ` · ${proposal.evidenceRefs.length} 条证据` : "", (proposal.preview?.diff ?? []).length ? ` · ${proposal.preview?.diff?.length ?? 0} 处变更` : "")),
    actionable ? /* @__PURE__ */ React13.createElement(
      "span",
      {
        className: "sy-acts",
        style: { flex: "none", display: "flex", position: "static", transform: "none", alignItems: "center" }
      },
      proposal.status === "pending" ? /* @__PURE__ */ React13.createElement(React13.Fragment, null, /* @__PURE__ */ React13.createElement(
        "button",
        {
          "data-act": "proposal-approve",
          "data-proposal": proposal.id,
          title: "批准并执行",
          "aria-label": "批准并执行"
        },
        /* @__PURE__ */ React13.createElement(SvgIcon, { svg: I.check })
      ), /* @__PURE__ */ React13.createElement("button", { "data-act": "proposal-reject", "data-proposal": proposal.id, title: "拒绝", "aria-label": "拒绝" }, /* @__PURE__ */ React13.createElement(SvgIcon, { svg: I.x }))) : proposal.status === "applied" ? /* @__PURE__ */ React13.createElement(React13.Fragment, null, /* @__PURE__ */ React13.createElement("span", { className: "meta" }, STATUS_LABELS[proposal.status] ?? proposal.status), /* @__PURE__ */ React13.createElement(
        "button",
        {
          "data-act": "proposal-rollback",
          "data-proposal": proposal.id,
          title: "撤销改动",
          "aria-label": "撤销改动"
        },
        /* @__PURE__ */ React13.createElement(SvgIcon, { svg: I.reset })
      )) : /* @__PURE__ */ React13.createElement("span", { className: "meta" }, STATUS_LABELS[proposal.status] ?? proposal.status)
    ) : null
  );
}
function AgentInboxWidget({ widget, size, context }) {
  const all = context.agentInbox ?? [];
  const pending = all.filter((entry) => entry.status === "pending");
  const decided = all.filter(
    (entry) => entry.status === "applied" || entry.status === "rejected" || entry.status === "rolled_back"
  );
  if (all.length === 0) {
    return /* @__PURE__ */ React13.createElement(EmptyWidgetState, { widget, size, context });
  }
  if (size === "S") {
    const first = pending[0] ?? decided[0];
    return /* @__PURE__ */ React13.createElement(React13.Fragment, null, /* @__PURE__ */ React13.createElement("div", { className: "sy-s-lab" }, /* @__PURE__ */ React13.createElement(WidgetIcon, { type: "agentInbox", size: 16 }), "待批建议"), /* @__PURE__ */ React13.createElement("div", { className: "sy-s-main" }, /* @__PURE__ */ React13.createElement("div", { className: "sy-s-big" }, pending.length), /* @__PURE__ */ React13.createElement("div", { className: "sy-s-sub" }, pending.length ? "条等你决定" : "都处理完了")), first ? /* @__PURE__ */ React13.createElement("div", { className: "sy-s-narrow" }, /* @__PURE__ */ React13.createElement("span", { className: "c1", style: { fontSize: 13 } }, first.reason)) : null);
  }
  if (size === "M") {
    return /* @__PURE__ */ React13.createElement(React13.Fragment, null, /* @__PURE__ */ React13.createElement("div", { className: "sy-list sy-fit", style: { gap: 0 } }, (pending.length ? pending : decided).slice(0, 4).map((proposal) => /* @__PURE__ */ React13.createElement(ProposalRow, { key: proposal.id, proposal, actionable: true }))), /* @__PURE__ */ React13.createElement("div", { className: "meta", style: { flex: "none" } }, pending.length, " 条待批 · ", decided.length, " 条已处理"));
  }
  return /* @__PURE__ */ React13.createElement(React13.Fragment, null, /* @__PURE__ */ React13.createElement("div", { className: "sy-list sy-fit", style: { gap: 0 } }, (pending.length ? pending : decided).slice(0, 6).map((proposal) => /* @__PURE__ */ React13.createElement(ProposalRow, { key: proposal.id, proposal, actionable: true }))), /* @__PURE__ */ React13.createElement("div", { className: "meta", style: { flex: "none" } }, "审批只在", /* @__PURE__ */ React13.createElement("b", null, "这台设备"), "上发生：Agent 不能自己批准自己的建议。批准后按条执行，失败的会标记为 failed。"));
}
var agentInboxWidgetDefinition = {
  type: "agentInbox",
  name: "Agent 收件箱",
  desc: "后台审阅给出的建议，等你批准或拒绝",
  priority: "P0",
  sizes: { S: [3, 2], M: [6, 2], L: [6, 4] },
  defaultSize: "S",
  actions: ["查看差异", "批准", "拒绝"],
  defaultSettings: () => ({}),
  normalizeSettings: () => ({}),
  Component: AgentInboxWidget,
  computeLayoutMeta: ({ context }) => {
    const all = context.agentInbox ?? [];
    if (all.length === 0) return { sub: "空" };
    const pending = all.filter((entry) => entry.status === "pending");
    return { sub: pending.length ? `${pending.length} 条待批` : "已清空" };
  }
};

// src/client/widgets/registry.ts
function UnknownWidgetFallback({ widget }) {
  return React14.createElement(
    "div",
    { className: "sy-empty", style: { padding: "12px 6px" } },
    React14.createElement(
      "div",
      { className: "meta" },
      `暂不支持的组件类型 (${widget.type ?? "unknown"})，配置已完整保留`
    )
  );
}
function SoonWidgetFallback({ widget, context }) {
  const label = widget?.title || context?.types?.[widget?.type]?.name || "这个 Widget";
  return React14.createElement(
    "div",
    { className: "sy-soon" },
    `${label}需要一个数据来源，还没接上。这个 Widget 暂时只占位。`
  );
}
function makeSoonDefinition(type, name, desc, sizes) {
  return {
    type,
    name,
    desc,
    priority: "P2",
    soon: true,
    sizes,
    defaultSize: "S",
    actions: [],
    defaultSettings: () => ({}),
    normalizeSettings: (raw) => raw && typeof raw === "object" ? { ...raw } : {},
    Component: SoonWidgetFallback,
    computeLayoutMeta: () => ({ sub: "即将推出" })
  };
}
var WIDGET_REGISTRY = {
  task: taskWidgetDefinition,
  subscription: subscriptionWidgetDefinition,
  capture: captureWidgetDefinition,
  notes: noteWidgetDefinition,
  bookmarks: bookmarksWidgetDefinition,
  project: projectWidgetDefinition,
  readlater: readLaterWidgetDefinition,
  agentInbox: agentInboxWidgetDefinition,
  habit: habitWidgetDefinition,
  focus: focusWidgetDefinition,
  calendar: makeSoonDefinition("calendar", "今日日程", "接入日历后展示", { S: [3, 2], M: [3, 4], L: [6, 4] }),
  weather: makeSoonDefinition("weather", "天气", "接入位置与天气源后展示", { S: [3, 2], M: [6, 2] }),
  briefing: makeSoonDefinition("briefing", "AI 简报", "基于今日内容生成一段简报", { M: [6, 2], L: [6, 4] }),
  embed: makeSoonDefinition("embed", "嵌入网页", "放一个可嵌入的页面", { M: [6, 2], L: [6, 4] })
};
function getWidgetDefinition(type) {
  return WIDGET_REGISTRY[type] ?? null;
}

// src/client/shell/WidgetFrame.tsx
function computeWidgetCardView(widget, size, context, options = {}) {
  const type = widget.type;
  const definition = getWidgetDefinition(type);
  const settings = definition ? definition.normalizeSettings(widget.settings) : widget.settings ?? {};
  const renderProps = {
    widget,
    size,
    settings,
    context,
    onAction: () => {
    }
  };
  const meta = definition?.computeLayoutMeta ? definition.computeLayoutMeta(renderProps) : { sub: "暂不支持" };
  const Component = definition ? definition.Component : UnknownWidgetFallback;
  const titleText = widgetTitle(widget, context);
  const menu = options.preview ? null : /* @__PURE__ */ React15.createElement(
    "button",
    {
      className: `sy-w-m${size === "S" || meta.noHeader ? " abs" : ""}`,
      "data-act": "w-menu",
      "data-w": widget.id,
      "aria-label": `${titleText}：更多操作`,
      "aria-haspopup": "menu"
    },
    /* @__PURE__ */ React15.createElement(SvgIcon, { svg: I.dots })
  );
  const header = size !== "S" && !meta.noHeader ? /* @__PURE__ */ React15.createElement("header", { className: "sy-w-h" }, /* @__PURE__ */ React15.createElement(WidgetIcon, { type }), /* @__PURE__ */ React15.createElement("div", { className: "sy-w-t" }, /* @__PURE__ */ React15.createElement("b", null, titleText), meta.sub ? /* @__PURE__ */ React15.createElement("span", null, meta.sub) : null), menu) : menu;
  const edit = options.preview ? null : /* @__PURE__ */ React15.createElement(React15.Fragment, null, /* @__PURE__ */ React15.createElement("div", { className: "sy-e-bar" }, (context.sizesOf(type) ?? []).map((entry) => /* @__PURE__ */ React15.createElement(
    "button",
    {
      key: entry,
      "data-act": "w-size",
      "data-w": widget.id,
      "data-size": entry,
      "aria-pressed": entry === size,
      title: `尺寸 ${entry}`
    },
    entry === "Wide" ? "W" : entry
  )), /* @__PURE__ */ React15.createElement("span", { className: "sep" }), /* @__PURE__ */ React15.createElement("button", { "data-act": "w-dup", "data-w": widget.id, title: "复制", "aria-label": "复制" }, /* @__PURE__ */ React15.createElement(SvgIcon, { svg: I.copy })), /* @__PURE__ */ React15.createElement("button", { className: "del", "data-act": "w-remove", "data-w": widget.id, title: "移除", "aria-label": "移除" }, /* @__PURE__ */ React15.createElement(SvgIcon, { svg: I.x }))), /* @__PURE__ */ React15.createElement("div", { className: "sy-e-rz", "data-rz": widget.id, title: "拖动改尺寸" }, /* @__PURE__ */ React15.createElement(SvgIcon, { svg: I.resize })));
  const cls = `sy-w sy-w--${size === "S" ? "s" : String(size).toLowerCase()} ${meta.cls ?? ""}`.trim();
  const content = /* @__PURE__ */ React15.createElement(React15.Fragment, null, meta.bg ?? null, meta.deco ? /* @__PURE__ */ React15.createElement(DecoImg, { name: meta.deco }) : null, header, /* @__PURE__ */ React15.createElement("div", { className: "sy-w-b" }, /* @__PURE__ */ React15.createElement(Component, { ...renderProps })), edit);
  return { cls, content };
}
function WidgetFrame({
  widget,
  size,
  position,
  context
}) {
  const ref = React15.useRef(null);
  const { cls, content } = computeWidgetCardView(widget, size, context);
  React15.useLayoutEffect(() => {
    if (ref.current) {
      fitDom(ref.current);
    }
  });
  return /* @__PURE__ */ React15.createElement(
    "section",
    {
      ref,
      className: cls,
      "data-id": widget.id,
      style: {
        gridColumn: `${position.x + 1} / span ${position.w}`,
        gridRow: `${position.y + 1} / span ${position.h}`
      }
    },
    content
  );
}
function MenuLayer({
  menu,
  widgets,
  types,
  context,
  onClose
}) {
  const style = {
    left: Math.max(12, Math.min(menu.rect.right - 216, (window.innerWidth || 1200) - 228)),
    top: Math.min(menu.rect.bottom + 6, (window.innerHeight || 800) - 320)
  };
  if (menu.kind === "board-new") {
    return /* @__PURE__ */ React15.createElement("div", { className: "sy-pop", style, role: "dialog", "aria-label": "新建 Board" }, /* @__PURE__ */ React15.createElement("div", { className: "sy-pop-h" }, "新建 Board"), /* @__PURE__ */ React15.createElement("form", { className: "sy-mi", "data-form": "board-new", style: { cursor: "default" } }, /* @__PURE__ */ React15.createElement(
      "input",
      {
        name: "name",
        placeholder: "例如：科研、旅行",
        autoComplete: "off",
        "aria-label": "Board 名称",
        autoFocus: true
      }
    ), /* @__PURE__ */ React15.createElement("button", { className: "sy-btn sy-btn-ink", style: { height: 30 } }, "创建")), /* @__PURE__ */ React15.createElement("div", { className: "meta", style: { padding: "2px 10px 8px", whiteSpace: "normal" } }, "新 Board 是空的，和其它 Board 共用同一份任务和订阅。"));
  }
  const widget = menu.id ? widgets[menu.id] : void 0;
  if (!widget) return null;
  const currentSize = (menu.id ? context.layoutSizes?.[menu.id] : void 0) ?? "M";
  return /* @__PURE__ */ React15.createElement("div", { className: "sy-pop", style, role: "menu" }, /* @__PURE__ */ React15.createElement("div", { className: "sy-pop-h" }, /* @__PURE__ */ React15.createElement("span", null, "尺寸"), /* @__PURE__ */ React15.createElement("span", { className: "meta" }, context.cols, " 列布局")), /* @__PURE__ */ React15.createElement("div", { className: "sizes" }, sizeOrder.map((entry) => /* @__PURE__ */ React15.createElement(
    "button",
    {
      key: entry,
      className: "sy-sz",
      "data-act": "w-size",
      "data-w": menu.id,
      "data-size": entry,
      "aria-pressed": currentSize === entry,
      disabled: !types[widget.type]?.sizes?.[entry],
      title: types[widget.type]?.sizes?.[entry] ? `尺寸 ${entry}` : "这个 Widget 没有这个尺寸"
    },
    entry
  ))), /* @__PURE__ */ React15.createElement("hr", null), /* @__PURE__ */ React15.createElement("button", { className: "sy-mi", "data-act": "w-refresh", "data-w": menu.id }, "刷新"), /* @__PURE__ */ React15.createElement("button", { className: "sy-mi", "data-act": "w-settings", "data-w": menu.id }, "设置…"), /* @__PURE__ */ React15.createElement("button", { className: "sy-mi", "data-act": "w-dup", "data-w": menu.id }, "复制"), /* @__PURE__ */ React15.createElement("button", { className: "sy-mi danger", "data-act": "w-remove", "data-w": menu.id }, "移除"), /* @__PURE__ */ React15.createElement("button", { className: "sy-mi", onClick: onClose }, "关闭"));
}

// src/client/shell/WidgetGrid.tsx
var React16 = __toESM(require("react"), 1);
function WidgetGrid({ gridRef, cols, layout, widgets, positions, context }) {
  return /* @__PURE__ */ React16.createElement(
    "div",
    {
      className: "sy-grid",
      ref: gridRef,
      style: { "--cols": cols }
    },
    layout.map((entry) => {
      const widget = widgets[entry.id];
      const position = positions[entry.id];
      if (!widget || !position) return null;
      return /* @__PURE__ */ React16.createElement(
        WidgetFrame,
        {
          key: entry.id,
          widget,
          size: entry.size,
          position,
          context
        }
      );
    }),
    layout.length === 0 ? /* @__PURE__ */ React16.createElement("div", { className: "sy-grid-empty" }, /* @__PURE__ */ React16.createElement("div", null, /* @__PURE__ */ React16.createElement("b", { style: { fontSize: 16, color: "var(--sy-ink)", display: "block" } }, "这个 Board 还是空的"), /* @__PURE__ */ React16.createElement("div", { className: "meta", style: { marginTop: 4, whiteSpace: "normal" } }, "从 Widget 库里挑几个。")), /* @__PURE__ */ React16.createElement("div", { className: "row-btns" }, /* @__PURE__ */ React16.createElement("button", { className: "sy-btn sy-btn-ink", "data-act": "gallery-open" }, "添加 Widget"))) : null
  );
}

// src/client/shell/WidgetSettings.tsx
var React18 = __toESM(require("react"), 1);

// src/client/shell/WidgetGallery.tsx
var React17 = __toESM(require("react"), 1);
var { useState: useState3 } = React17;
function GallerySheet({ initial, types, context, board, onAdd, onClose }) {
  const [type, setType] = useState3(types[initial.type] ? initial.type : "subscription");
  const [size, setSize] = useState3(initial.size ?? "M");
  const [sources, setSources] = useState3(initial.sources ?? ["aihot"]);
  const [pres, setPres] = useState3(initial.pres ?? null);
  const definition = types[type] ?? { name: type, desc: "", sizes: {}, actions: [] };
  const available = sizeOrder.filter((entry) => definition.sizes?.[entry]);
  const activeSize = available.includes(size) ? size : available[0] ?? "M";
  const suggested = pres ?? context.sources.find((source) => source.id === sources[0])?.suggests?.pres ?? "图文";
  const settings = type === "subscription" ? { sources, pres: suggested, sort: sources[0] === "aihot-hot" ? "rank" : "new" } : {};
  const previewWidget = {
    id: "preview",
    type,
    size: activeSize,
    settings,
    title: void 0
  };
  const preview = computeWidgetCardView(previewWidget, activeSize, context, { preview: true });
  const [gridCols, gridRows] = definition.sizes?.[activeSize] ?? [3, 2];
  const previewWidth = gridCols * 68 + (gridCols - 1) * GAP;
  const previewHeight = gridRows * ROW + (gridRows - 1) * GAP;
  const scale = Math.min(0.9, 440 / previewWidth, 230 / previewHeight);
  const groups = [
    ["P0", "常用"],
    ["P1", "更多"],
    ["P2", "即将推出"]
  ];
  return /* @__PURE__ */ React17.createElement("div", { className: "sy-scrim", "data-act": "scrim" }, /* @__PURE__ */ React17.createElement("div", { className: "sy-sheet", role: "dialog", "aria-modal": true, "aria-label": "Widget 库" }, /* @__PURE__ */ React17.createElement("header", { className: "sy-sh-h" }, /* @__PURE__ */ React17.createElement("h2", null, "Widget 库"), /* @__PURE__ */ React17.createElement("span", { className: "meta" }, "加到「", board?.name ?? "", "」"), /* @__PURE__ */ React17.createElement("button", { className: "sy-icon-btn", "data-act": "modal-close", "aria-label": "关闭" }, /* @__PURE__ */ React17.createElement(SvgIcon, { svg: I.x }))), /* @__PURE__ */ React17.createElement("div", { className: "sy-gal" }, /* @__PURE__ */ React17.createElement("div", { className: "sy-gal-l" }, groups.map(([priority, heading]) => /* @__PURE__ */ React17.createElement(React17.Fragment, { key: priority }, /* @__PURE__ */ React17.createElement("h3", null, heading), Object.entries(types).filter(
    ([, value]) => priority === "P2" ? value.soon : !value.soon && (value.pri ?? "P0") === priority
  ).map(([key, value]) => /* @__PURE__ */ React17.createElement(
    "button",
    {
      key,
      className: "sy-gal-it",
      "aria-pressed": key === type,
      onClick: () => {
        setType(key);
        const next = sizeOrder.filter((entry) => types[key]?.sizes?.[entry]);
        setSize((current) => next.includes(current) ? current : next[0] ?? "M");
      }
    },
    /* @__PURE__ */ React17.createElement(WidgetIcon, { type: key, size: 32 }),
    /* @__PURE__ */ React17.createElement("span", { style: { minWidth: 0 } }, /* @__PURE__ */ React17.createElement("b", null, value.name), /* @__PURE__ */ React17.createElement("small", null, value.desc)),
    value.soon ? /* @__PURE__ */ React17.createElement("span", { className: "soon-b" }, "SOON") : null
  ))))), /* @__PURE__ */ React17.createElement("div", { className: "sy-gal-r" }, /* @__PURE__ */ React17.createElement("div", { className: "sy-pv" }, /* @__PURE__ */ React17.createElement(
    "div",
    {
      className: "sy-pv-in",
      style: { transform: `translate(-50%, -50%) scale(${scale.toFixed(3)})` }
    },
    /* @__PURE__ */ React17.createElement("section", { className: preview.cls, style: { width: previewWidth, height: previewHeight } }, preview.content)
  ), /* @__PURE__ */ React17.createElement("span", { className: "sy-pv-cap" }, activeSize, " · ", gridCols, "×", gridRows, " 格（桌面）")), /* @__PURE__ */ React17.createElement("div", { className: "sy-gal-meta" }, /* @__PURE__ */ React17.createElement("div", { className: "sy-fld" }, /* @__PURE__ */ React17.createElement("span", null, "尺寸"), /* @__PURE__ */ React17.createElement("div", { className: "sy-seg sm" }, sizeOrder.map((entry) => /* @__PURE__ */ React17.createElement(
    "button",
    {
      key: entry,
      "aria-pressed": entry === activeSize,
      disabled: !definition.sizes?.[entry],
      style: definition.sizes?.[entry] ? void 0 : { opacity: 0.3, cursor: "not-allowed" },
      onClick: () => setSize(entry)
    },
    entry
  )))), type === "subscription" ? /* @__PURE__ */ React17.createElement("div", { className: "sy-fld" }, /* @__PURE__ */ React17.createElement("span", null, "来源"), /* @__PURE__ */ React17.createElement("div", { className: "sy-chips" }, (context.sources ?? []).map((source) => /* @__PURE__ */ React17.createElement(
    "button",
    {
      key: source.id,
      className: "sy-chipbtn",
      "aria-pressed": sources.includes(source.id),
      onClick: () => {
        setPres(null);
        setSources(
          (current) => current.includes(source.id) ? current.length > 1 ? current.filter((entry) => entry !== source.id) : current : [...current, source.id]
        );
      }
    },
    source.label
  )))) : null, type === "subscription" ? /* @__PURE__ */ React17.createElement("div", { className: "sy-fld" }, /* @__PURE__ */ React17.createElement("span", null, "呈现"), /* @__PURE__ */ React17.createElement("div", { className: "sy-seg sm" }, ["图文", "榜单", "论文", "产品", "视频"].map((entry) => /* @__PURE__ */ React17.createElement(
    "button",
    {
      key: entry,
      "aria-pressed": suggested === entry,
      onClick: () => setPres(entry)
    },
    entry
  )))) : null), /* @__PURE__ */ React17.createElement("div", { className: "sy-gal-acts" }, (definition.actions ?? []).length ? `能直接做：${definition.actions.join(" · ")}` : "只展示，不需要操作。"), /* @__PURE__ */ React17.createElement(
    "button",
    {
      className: "sy-btn sy-btn-wide",
      disabled: Boolean(definition.soon),
      onClick: () => {
        if (definition.soon) return;
        onAdd(type, activeSize, type === "subscription" ? { ...settings, deck: false } : {});
        onClose();
      }
    },
    definition.soon ? "即将推出" : `添加到「${board?.name ?? ""}」`
  )))));
}

// src/client/shell/WidgetSettings.tsx
function ModalLayer({
  modal,
  widgets,
  types,
  context,
  board,
  onClose,
  onAdd,
  onRun
}) {
  if (modal.kind === "gallery") {
    return /* @__PURE__ */ React18.createElement(
      GallerySheet,
      {
        initial: modal,
        types,
        context,
        board,
        onAdd,
        onClose
      }
    );
  }
  if (modal.kind === "settings") {
    const widget = widgets[modal.id];
    if (!widget) return null;
    const settings = widget.settings ?? {};
    return /* @__PURE__ */ React18.createElement("div", { className: "sy-scrim", "data-act": "scrim" }, /* @__PURE__ */ React18.createElement("div", { className: "sy-sheet sm", role: "dialog", "aria-modal": true, "aria-label": "Widget 设置" }, /* @__PURE__ */ React18.createElement("header", { className: "sy-sh-h" }, /* @__PURE__ */ React18.createElement(WidgetIcon, { type: widget.type, size: 26 }), /* @__PURE__ */ React18.createElement("h2", null, types[widget.type]?.name ?? "", "设置"), /* @__PURE__ */ React18.createElement("button", { className: "sy-icon-btn", "data-act": "modal-close", "aria-label": "关闭" }, /* @__PURE__ */ React18.createElement(SvgIcon, { svg: I.x }))), /* @__PURE__ */ React18.createElement("div", { className: "sy-sh-b" }, widget.type === "subscription" ? /* @__PURE__ */ React18.createElement(React18.Fragment, null, /* @__PURE__ */ React18.createElement("label", { className: "sy-fld" }, /* @__PURE__ */ React18.createElement("span", null, "标题"), /* @__PURE__ */ React18.createElement(
      "input",
      {
        type: "text",
        name: "title",
        defaultValue: widget.title ?? "",
        placeholder: widgetTitle(widget, context)
      }
    )), /* @__PURE__ */ React18.createElement("div", { className: "sy-fld" }, /* @__PURE__ */ React18.createElement("span", null, "来源（可多选）"), /* @__PURE__ */ React18.createElement("div", { className: "sy-chips" }, (context.sources ?? []).map((source) => /* @__PURE__ */ React18.createElement(
      "button",
      {
        key: source.id,
        className: "sy-chipbtn",
        "aria-pressed": (settings.sources ?? []).includes(source.id),
        onClick: () => {
          const current = settings.sources ?? [];
          const next = current.includes(source.id) ? current.length > 1 ? current.filter((entry) => entry !== source.id) : current : [...current, source.id];
          void onRun("widget.update", { id: widget.id, settings: { ...settings, sources: next } });
        }
      },
      source.label
    )))), /* @__PURE__ */ React18.createElement("div", { className: "sy-fld" }, /* @__PURE__ */ React18.createElement("span", null, "呈现"), /* @__PURE__ */ React18.createElement("div", { className: "sy-seg sm" }, ["图文", "榜单", "论文", "产品", "视频"].map((entry) => /* @__PURE__ */ React18.createElement(
      "button",
      {
        key: entry,
        "aria-pressed": (settings.pres ?? "图文") === entry,
        onClick: () => void onRun("widget.update", { id: widget.id, settings: { ...settings, pres: entry } })
      },
      entry
    )))), /* @__PURE__ */ React18.createElement("div", { className: "sy-fld" }, /* @__PURE__ */ React18.createElement("span", null, "布局"), /* @__PURE__ */ React18.createElement("div", { className: "sy-seg sm" }, /* @__PURE__ */ React18.createElement(
      "button",
      {
        "aria-pressed": !settings.deck,
        onClick: () => void onRun("widget.update", { id: widget.id, settings: { ...settings, deck: false } })
      },
      "列表"
    ), /* @__PURE__ */ React18.createElement(
      "button",
      {
        "aria-pressed": Boolean(settings.deck),
        onClick: () => void onRun("widget.update", { id: widget.id, settings: { ...settings, deck: true } })
      },
      "卡片流 · 一次一条"
    ))), /* @__PURE__ */ React18.createElement("div", { className: "sy-fld" }, /* @__PURE__ */ React18.createElement("span", null, "排序"), /* @__PURE__ */ React18.createElement("div", { className: "sy-seg sm" }, SUB_SORTS.map(([key, label]) => /* @__PURE__ */ React18.createElement(
      "button",
      {
        key,
        "aria-pressed": (settings.sort ?? "new") === key,
        onClick: () => void onRun("widget.update", { id: widget.id, settings: { ...settings, sort: key } })
      },
      label
    )))), /* @__PURE__ */ React18.createElement("label", { className: "sy-fld" }, /* @__PURE__ */ React18.createElement("span", null, "关注词（逗号分隔，所有订阅共用）"), /* @__PURE__ */ React18.createElement(
      "input",
      {
        type: "text",
        name: "interests",
        defaultValue: (context.interests ?? []).join("，"),
        onBlur: (event) => void onRun("interests.set", { text: event.target.value })
      }
    ), /* @__PURE__ */ React18.createElement("span", { className: "meta", style: { whiteSpace: "normal" } }, "命中的条目会带上标记；排序选「关注优先」时排在前面。"))) : /* @__PURE__ */ React18.createElement("p", { style: { margin: 0, fontSize: 13, color: "var(--sy-ink2)", whiteSpace: "normal" } }, "「", types[widget.type]?.name ?? "", "」目前没有可配置项。尺寸在卡片菜单里改。")), /* @__PURE__ */ React18.createElement("footer", { className: "sy-sh-f" }, /* @__PURE__ */ React18.createElement("button", { className: "sy-btn sy-btn-ink", "data-act": "modal-close" }, "完成"))));
  }
  return null;
}

// src/client/views/Cards.tsx
var React20 = __toESM(require("react"), 1);

// src/client/views/Stamps.tsx
var React19 = __toESM(require("react"), 1);
var { useMemo } = React19;
function toDayKey(input) {
  if (!input) return "";
  if (typeof input === "string" && /^\d{4}-\d{2}-\d{2}/.test(input)) {
    return input.slice(0, 10);
  }
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function hashCode(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}
function buildDayFootprintMap(notes, tasks, readLaterEntries, retros) {
  const map = /* @__PURE__ */ new Map();
  const push = (day, entry) => {
    if (!day) return;
    const list = map.get(day) ?? [];
    list.push(entry);
    map.set(day, list);
  };
  for (const note of notes) {
    const day = toDayKey(note.createdAt);
    push(day, {
      id: note.id,
      kind: "note",
      title: note.title || note.text.slice(0, 40),
      thumbnail: null,
      createdAt: note.createdAt
    });
  }
  for (const [id, snap] of Object.entries(readLaterEntries ?? {})) {
    if (!snap) continue;
    const day = toDayKey(snap.savedAt || snap.publishedAt);
    push(day, {
      id,
      kind: "collection",
      title: snap.title,
      thumbnail: snap.thumbnail ?? snap.cover ?? null,
      createdAt: snap.savedAt || snap.publishedAt || ""
    });
  }
  for (const task of tasks) {
    if (task.done && (task.completedAt || task.updatedAt || task.createdAt)) {
      const day = toDayKey(task.completedAt || task.updatedAt || task.createdAt);
      push(day, {
        id: task.id,
        kind: "task",
        title: task.title,
        thumbnail: null,
        createdAt: task.completedAt || task.updatedAt || task.createdAt
      });
    }
  }
  for (const retro of Object.values(retros ?? {})) {
    if (!retro?.updatedAt) continue;
    const day = toDayKey(retro.updatedAt);
    push(day, {
      id: retro.key,
      kind: "retro",
      title: retro.highlights || retro.nextFocus || "个人复盘",
      thumbnail: null,
      createdAt: retro.updatedAt
    });
  }
  return map;
}
function computeActiveStreak(dayMap) {
  let streak = 0;
  const cursor = /* @__PURE__ */ new Date();
  for (let i = 0; i < 365; i += 1) {
    const key = toDayKey(cursor);
    const hasActivity = (dayMap.get(key)?.length ?? 0) > 0;
    if (hasActivity) {
      streak += 1;
    } else if (i > 0) {
      break;
    }
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}
function useDayFootprintMap(notes, tasks, readLaterEntries, retros) {
  return useMemo(
    () => buildDayFootprintMap(notes, tasks, readLaterEntries, retros),
    [notes, tasks, readLaterEntries, retros]
  );
}
function Stamp({
  list,
  today,
  label,
  onOpen,
  onCaptureToday
}) {
  if (!list || list.length === 0) {
    return /* @__PURE__ */ React19.createElement(
      "button",
      {
        type: "button",
        className: `sy-stamp is-blank${today ? " is-today" : ""}`,
        "aria-label": today ? "今天还没有记录，记一条" : `${label} 没有记录`,
        title: today ? "今天还没有记录，点击记一条" : `${label} 无记录`,
        onClick: today ? onCaptureToday : void 0,
        disabled: !today
      },
      today ? /* @__PURE__ */ React19.createElement("span", null, "+") : null
    );
  }
  const cover = list.find((item) => Boolean(item.thumbnail)) ?? list[0];
  const tone = hashCode(cover.id) % 6;
  const glyph = (cover.title || "记").replace(/^[#*\s]+/, "").slice(0, 1) || "记";
  return /* @__PURE__ */ React19.createElement(
    "button",
    {
      type: "button",
      className: `sy-stamp ${cover.thumbnail ? "has-img" : `is-type tone-${tone}`}${today ? " is-today" : ""}`,
      "aria-label": `${label}：${cover.title}，共 ${list.length} 条`,
      title: `${label}：${cover.title}（共 ${list.length} 条记录）`,
      onClick: onOpen
    },
    cover.thumbnail ? /* @__PURE__ */ React19.createElement("img", { src: cover.thumbnail, alt: "", loading: "lazy", draggable: false, referrerPolicy: "no-referrer" }) : /* @__PURE__ */ React19.createElement("span", null, glyph),
    list.length > 1 ? /* @__PURE__ */ React19.createElement("i", null, list.length) : null
  );
}
function MiniStamps({
  dayMap,
  onOpenSchedule,
  onCaptureToday
}) {
  const streak = useMemo(() => computeActiveStreak(dayMap), [dayMap]);
  const todayKey = toDayKey(/* @__PURE__ */ new Date());
  const cells = useMemo(() => {
    const out = [];
    const now = /* @__PURE__ */ new Date();
    for (let i = 9; i >= 0; i -= 1) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      out.push(d);
    }
    return out;
  }, []);
  return /* @__PURE__ */ React19.createElement("div", { className: "sy-ministamps", "aria-label": `最近 10 天活动邮票，已连续记录 ${streak} 天` }, /* @__PURE__ */ React19.createElement("div", { className: "sy-ministamps-row" }, cells.map((d) => {
    const key = toDayKey(d);
    const list = dayMap.get(key);
    const label = `${d.getMonth() + 1}月${d.getDate()}日`;
    return /* @__PURE__ */ React19.createElement(
      Stamp,
      {
        key,
        list,
        today: key === todayKey,
        label,
        onCaptureToday,
        onOpen: () => onOpenSchedule(key)
      }
    );
  })), /* @__PURE__ */ React19.createElement(
    "button",
    {
      type: "button",
      className: "sy-ministamps-more",
      onClick: () => onOpenSchedule(todayKey),
      title: `打开排期日历（已连续记录 ${streak} 天）`,
      "aria-label": `打开排期日历，已连续记录 ${streak} 天`
    },
    /* @__PURE__ */ React19.createElement("span", null, streak, "天"),
    /* @__PURE__ */ React19.createElement("span", { "aria-hidden": "true" }, "↗")
  ));
}

// src/client/views/Cards.tsx
var { useState: useState4, useEffect: useEffect2 } = React20;
var KIND_FILTER_OPTIONS = [
  { value: "all", label: "全部" },
  { value: "note", label: "速记备忘" },
  { value: "github", label: "GitHub" },
  { value: "x", label: "X 收藏" },
  { value: "web", label: "网站" },
  { value: "image", label: "图片" },
  { value: "music", label: "音乐" },
  { value: "video", label: "视频" }
];
var KIND_BADGE_LABELS = {
  note: "速记备忘",
  github: "GitHub",
  x: "X 收藏",
  web: "网站",
  image: "图片",
  music: "音乐",
  video: "视频",
  article: "精选资讯"
};
var STATUS_OPTIONS = [
  { value: "inbox", label: "待看 / 未整理" },
  { value: "curated", label: "精选常看" },
  { value: "archived", label: "已归档" }
];
function detectKindFromUrl(url, fallback = "web") {
  const u = String(url ?? "").trim();
  if (!u) return fallback;
  if (/github\.com\//i.test(u)) return "github";
  if (/(^|\/\/|\.)(x\.com|twitter\.com)\//i.test(u)) return "x";
  if (/\.(png|jpe?g|webp|gif|avif|svg)(\?|$)/i.test(u)) return "image";
  if (/\.(mp4|webm|mov|m4v)(\?|$)/i.test(u) || /(youtube\.com|youtu\.be|bilibili\.com|b23\.tv|vimeo\.com)/i.test(u)) return "video";
  if (/\.(mp3|flac|wav|ogg|m4a)(\?|$)/i.test(u) || /(music\.163\.com|y\.qq\.com|spotify\.com|music\.apple\.com|soundcloud\.com)/i.test(u)) return "music";
  return fallback;
}
function hostOfUrl(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}
function relativeTimeShort(iso) {
  if (!iso) return "";
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return "";
  const diffSec = Math.max(0, Math.floor((Date.now() - ts) / 1e3));
  if (diffSec < 60) return "刚刚";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}分钟前`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}小时前`;
  const days = Math.floor(diffSec / 86400);
  if (days < 30) return `${days}天前`;
  const d = new Date(ts);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}
function buildUnifiedEntries(notes, readLaterEntries, bookmarks, feedItems, includeFeed = true) {
  const list = [];
  const seenUrls = /* @__PURE__ */ new Set();
  for (const note of notes) {
    const firstLine = (note.title || note.text.split(/[。！？\n]/)[0] || note.text).slice(0, 64);
    const restBody = note.title ? note.text : note.text.length > firstLine.length ? note.text : "";
    list.push({
      id: `note:${note.id}`,
      entryType: "note",
      kind: "note",
      status: note.status || "inbox",
      title: firstLine || "速记",
      body: restBody,
      url: note.origin?.url ?? "",
      externalUrl: note.externalUrl ?? null,
      thumbnail: null,
      sourceLabel: note.origin?.source ?? note.origin?.title ?? "灵感速记",
      tags: Array.isArray(note.tags) ? note.tags : [],
      meta: null,
      createdAt: note.createdAt || (/* @__PURE__ */ new Date()).toISOString(),
      rawNote: note
    });
  }
  for (const [id, snap] of Object.entries(readLaterEntries ?? {})) {
    if (!snap || typeof snap !== "object") continue;
    const k = snap.kind || detectKindFromUrl(snap.url || "", "article");
    if (snap.url) seenUrls.add(snap.url);
    list.push({
      id: `col:${id}`,
      entryType: "collection",
      kind: k,
      status: snap.status || "inbox",
      title: snap.title || "(未命名收藏)",
      body: snap.summary || snap.tldr || snap.reason || "",
      url: snap.url || "",
      externalUrl: snap.externalUrl ?? null,
      thumbnail: snap.thumbnail ?? snap.cover ?? null,
      sourceLabel: snap.sourceLabel || snap.origin || hostOfUrl(snap.url || "") || KIND_BADGE_LABELS[k] || "收藏",
      tags: Array.isArray(snap.tags) ? snap.tags : [],
      meta: snap.meta ?? snap.metrics ?? null,
      createdAt: snap.savedAt || snap.publishedAt || (/* @__PURE__ */ new Date()).toISOString(),
      rawCollection: { ...snap, id }
    });
  }
  for (let i = 0; i < bookmarks.length; i += 1) {
    const bm = bookmarks[i];
    if (!bm?.url || seenUrls.has(bm.url)) continue;
    seenUrls.add(bm.url);
    const k = detectKindFromUrl(bm.url, "web");
    list.push({
      id: `bm:${i}-${bm.name}`,
      entryType: "collection",
      kind: k,
      status: "curated",
      title: bm.name,
      body: hostOfUrl(bm.url),
      url: bm.url,
      externalUrl: null,
      thumbnail: null,
      sourceLabel: hostOfUrl(bm.url) || "常用网站",
      tags: ["常用书签"],
      meta: null,
      createdAt: "",
      rawCollection: {
        id: `bm-${i}`,
        title: bm.name,
        url: bm.url,
        kind: k,
        status: "curated",
        sourceLabel: hostOfUrl(bm.url) || "网站"
      }
    });
  }
  if (includeFeed) {
    for (const item of feedItems.slice(0, 18)) {
      if (item.url && seenUrls.has(item.url)) continue;
      const k = item.sourceId === "youtube" || item.kind === "episode" || item.kind === "short" ? "video" : "article";
      list.push({
        id: `feed:${item.id}`,
        entryType: "feed",
        kind: k,
        status: "inbox",
        title: item.title,
        body: item.tldr || item.summary || item.reason || "",
        url: item.url,
        externalUrl: null,
        thumbnail: item.thumbnail ?? item.cover ?? null,
        sourceLabel: item.sourceLabel || item.origin || "订阅源",
        tags: item.tags ?? item.keywords ?? [],
        meta: item.metrics ?? null,
        createdAt: item.publishedAt || "",
        rawFeed: item
      });
    }
  }
  return list;
}
function MediaCollectionCard({
  entry,
  relatedHighlight,
  draggable,
  onDragStart,
  onOpen,
  onQuickSaveFeed,
  onQuickTask
}) {
  const [imgBroken, setImgBroken] = useState4(false);
  const showMedia = Boolean(entry.thumbnail) && !imgBroken;
  const tone = hashCode(entry.id) % 6;
  const stars = entry.meta?.stars ?? entry.meta?.upvotes ?? null;
  const language = entry.meta?.language ?? null;
  const author = entry.meta?.author ?? entry.meta?.artist ?? null;
  const duration = entry.meta?.duration ?? null;
  return /* @__PURE__ */ React20.createElement(
    "article",
    {
      className: `sy-mcard kind-${entry.kind} status-${entry.status}${relatedHighlight ? " is-related" : ""}`,
      "data-card-id": entry.id,
      draggable,
      onDragStart: (e) => onDragStart?.(e, entry),
      onClick: () => onOpen(entry),
      tabIndex: 0,
      role: "button",
      "aria-label": `${KIND_BADGE_LABELS[entry.kind] ?? entry.kind}：${entry.title}`,
      onKeyDown: (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen(entry);
        }
      }
    },
    showMedia ? /* @__PURE__ */ React20.createElement("div", { className: "sy-mcard-media" }, /* @__PURE__ */ React20.createElement(
      "img",
      {
        src: entry.thumbnail,
        alt: "",
        loading: "lazy",
        draggable: false,
        referrerPolicy: "no-referrer",
        onError: () => setImgBroken(true)
      }
    ), entry.kind === "video" ? /* @__PURE__ */ React20.createElement("span", { className: "sy-mcard-badge" }, "▶ ", duration || "视频") : null, entry.kind === "music" ? /* @__PURE__ */ React20.createElement("span", { className: "sy-mcard-badge" }, "♪ ", duration || "音乐") : null, entry.kind === "image" ? /* @__PURE__ */ React20.createElement("span", { className: "sy-mcard-badge" }, "图片") : null) : entry.kind === "music" || entry.kind === "image" || entry.kind === "video" ? /* @__PURE__ */ React20.createElement("div", { className: `sy-mcard-fallback tone-${tone}` }, /* @__PURE__ */ React20.createElement("span", null, entry.kind === "music" ? "♪" : entry.kind === "video" ? "▶" : "▨"), /* @__PURE__ */ React20.createElement("small", null, KIND_BADGE_LABELS[entry.kind])) : null,
    /* @__PURE__ */ React20.createElement("div", { className: "sy-mcard-body" }, /* @__PURE__ */ React20.createElement("div", { className: "sy-mcard-top" }, /* @__PURE__ */ React20.createElement("span", { className: `sy-mcard-pill kind-${entry.kind}` }, KIND_BADGE_LABELS[entry.kind] ?? entry.kind), language ? /* @__PURE__ */ React20.createElement("span", { className: "sy-mcard-meta-tag" }, language) : null, stars !== null && stars !== void 0 ? /* @__PURE__ */ React20.createElement("span", { className: "sy-mcard-meta-tag" }, "★ ", stars) : null, author ? /* @__PURE__ */ React20.createElement("span", { className: "sy-mcard-meta-tag" }, "@", String(author).replace(/^@/, "")) : null, entry.externalUrl ? /* @__PURE__ */ React20.createElement("span", { className: "sy-mcard-feishu", title: "已关联外部文档（如飞书）" }, "飞书/外链 ↗") : null), /* @__PURE__ */ React20.createElement("h3", { className: "sy-mcard-title" }, entry.title), entry.body ? /* @__PURE__ */ React20.createElement("p", { className: "sy-mcard-desc" }, entry.body) : null, entry.tags.length > 0 ? /* @__PURE__ */ React20.createElement("div", { className: "sy-mcard-tags" }, entry.tags.slice(0, 4).map((tag) => /* @__PURE__ */ React20.createElement("span", { key: tag, className: "sy-mcard-tag" }, "#", tag.replace(/^#/, "")))) : null),
    /* @__PURE__ */ React20.createElement("footer", { className: "sy-mcard-foot", onClick: (e) => e.stopPropagation() }, /* @__PURE__ */ React20.createElement("span", { className: `sy-mcard-dot status-${entry.status}` }), /* @__PURE__ */ React20.createElement("span", { className: "sy-mcard-source" }, entry.sourceLabel), /* @__PURE__ */ React20.createElement("span", { className: "sy-mcard-time" }, relativeTimeShort(entry.createdAt)), /* @__PURE__ */ React20.createElement("span", { className: "sy-mcard-acts" }, entry.entryType === "feed" && onQuickSaveFeed ? /* @__PURE__ */ React20.createElement(
      "button",
      {
        type: "button",
        className: "sy-mini-act",
        title: "收入个人收藏库",
        onClick: () => onQuickSaveFeed(entry)
      },
      "+收藏"
    ) : null, onQuickTask ? /* @__PURE__ */ React20.createElement(
      "button",
      {
        type: "button",
        className: "sy-mini-act",
        title: "转为排期任务",
        onClick: () => onQuickTask(entry)
      },
      "+待办"
    ) : null, entry.url ? /* @__PURE__ */ React20.createElement(
      "a",
      {
        className: "sy-mini-act",
        href: safeUrl(entry.url),
        target: "_blank",
        rel: "noopener noreferrer",
        title: "打开原链接"
      },
      "↗"
    ) : null))
  );
}
function CaptureModal({
  initialTab = "note",
  onClose,
  onRun
}) {
  const [tab, setTab] = useState4(initialTab);
  const [text, setText] = useState4("");
  const [title, setTitle] = useState4("");
  const [url, setUrl] = useState4("");
  const [externalUrl, setExternalUrl] = useState4("");
  const [thumbnail, setThumbnail] = useState4("");
  const [kind, setKind] = useState4("github");
  const [tagsText, setTagsText] = useState4("");
  const [due, setDue] = useState4("");
  const [priority, setPriority] = useState4("medium");
  const [project, setProject] = useState4("");
  const [metaExtra, setMetaExtra] = useState4("");
  const [batchJson, setBatchJson] = useState4("");
  const [busy, setBusy] = useState4(false);
  useEffect2(() => {
    if (url.trim()) {
      setKind(detectKindFromUrl(url.trim(), kind));
    }
  }, [url]);
  const parseTags = (raw) => raw.split(/[,，、\s#]+/).map((s) => s.trim()).filter(Boolean).slice(0, 10);
  const handleSubmit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (tab === "note") {
        if (!text.trim()) return;
        await onRun(
          "note.add",
          {
            title: title.trim() || void 0,
            text: text.trim(),
            tags: parseTags(tagsText),
            externalUrl: externalUrl.trim() || null
          },
          { toast: "已记下灵感/备忘" }
        );
        onClose();
      } else if (tab === "task") {
        if (!title.trim()) return;
        await onRun(
          "task.add",
          {
            title: title.trim(),
            due: due || null,
            priority,
            project: project.trim() || null,
            note: text.trim() || void 0
          },
          { toast: due ? `已新建并排期至 ${due}` : "已新建到待排期收件箱" }
        );
        onClose();
      } else if (tab === "collection") {
        if (!title.trim() && !url.trim()) return;
        const meta = {};
        if (metaExtra.trim()) {
          if (kind === "github") meta.language = metaExtra.trim();
          else if (kind === "x") meta.author = metaExtra.trim();
          else if (kind === "music" || kind === "video") meta.duration = metaExtra.trim();
        }
        await onRun(
          "collection.save",
          {
            kind,
            title: title.trim() || url.trim(),
            url: url.trim() || void 0,
            thumbnail: thumbnail.trim() || void 0,
            summary: text.trim(),
            externalUrl: externalUrl.trim() || void 0,
            tags: parseTags(tagsText),
            meta: Object.keys(meta).length > 0 ? meta : void 0
          },
          { toast: `已存入「${KIND_BADGE_LABELS[kind]}」收藏库` }
        );
        onClose();
      } else if (tab === "batch") {
        if (!batchJson.trim()) return;
        let items = [];
        try {
          const parsed = JSON.parse(batchJson.trim());
          items = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.items) ? parsed.items : [parsed];
        } catch {
          items = batchJson.trim().split(/\r?\n/).map((line) => {
            const [k, t, u, thumb, sum] = line.split(/[,，\t]/).map((c) => c.trim());
            if (!t && !u) return null;
            return {
              kind: detectKindFromUrl(u || "", k || "web"),
              title: t || u,
              url: u || "",
              thumbnail: thumb || void 0,
              summary: sum || ""
            };
          }).filter(Boolean);
        }
        if (items.length > 0) {
          await onRun("collection.save", { items }, { toast: `已批量导入 ${items.length} 条收藏元信息` });
          onClose();
        }
      }
    } finally {
      setBusy(false);
    }
  };
  return /* @__PURE__ */ React20.createElement("div", { className: "sy-scrim", "data-act": "scrim", onClick: (e) => {
    if (e.target === e.currentTarget) onClose();
  } }, /* @__PURE__ */ React20.createElement("div", { className: "sy-modal sy-capture-modal", role: "dialog", "aria-label": "快速记录与收藏入库" }, /* @__PURE__ */ React20.createElement("div", { className: "sy-modal-h" }, /* @__PURE__ */ React20.createElement("div", null, /* @__PURE__ */ React20.createElement("b", null, "快速记录 · 收藏入库"), /* @__PURE__ */ React20.createElement("div", { className: "meta" }, "只存轻量备忘与多媒介元信息（缩略图、标题、说明、外链），长文可关联飞书文档")), /* @__PURE__ */ React20.createElement("button", { type: "button", className: "sy-icon-btn", onClick: onClose, "aria-label": "关闭" }, "✕")), /* @__PURE__ */ React20.createElement("div", { className: "sy-capture-tabs", role: "tablist" }, [
    ["note", "速记 / 灵感"],
    ["collection", "偏好收藏 (GitHub/X/图音视)"],
    ["task", "排期任务 (Todo)"],
    ["batch", "批量导入 (JSON/CSV)"]
  ].map(([id, label]) => /* @__PURE__ */ React20.createElement(
    "button",
    {
      key: id,
      type: "button",
      role: "tab",
      "aria-selected": tab === id,
      className: tab === id ? "is-on" : "",
      onClick: () => setTab(id)
    },
    label
  ))), /* @__PURE__ */ React20.createElement("form", { className: "sy-modal-b sy-form-stack", onSubmit: handleSubmit }, tab === "note" ? /* @__PURE__ */ React20.createElement(React20.Fragment, null, /* @__PURE__ */ React20.createElement("label", { className: "sy-field" }, /* @__PURE__ */ React20.createElement("span", null, "备忘 / 灵感闪念 *"), /* @__PURE__ */ React20.createElement(
    "textarea",
    {
      rows: 3,
      required: true,
      value: text,
      onChange: (e) => setText(e.target.value),
      placeholder: "随手记下一句话、一个灵感或备忘要点……"
    }
  )), /* @__PURE__ */ React20.createElement("div", { className: "sy-form-row2" }, /* @__PURE__ */ React20.createElement("label", { className: "sy-field" }, /* @__PURE__ */ React20.createElement("span", null, "短标题（可选）"), /* @__PURE__ */ React20.createElement("input", { value: title, onChange: (e) => setTitle(e.target.value), placeholder: "默认取第一句" })), /* @__PURE__ */ React20.createElement("label", { className: "sy-field" }, /* @__PURE__ */ React20.createElement("span", null, "标签（逗号或空格分隔）"), /* @__PURE__ */ React20.createElement("input", { value: tagsText, onChange: (e) => setTagsText(e.target.value), placeholder: "如：灵感, 架构, 生活" }))), /* @__PURE__ */ React20.createElement("label", { className: "sy-field" }, /* @__PURE__ */ React20.createElement("span", null, "关联飞书 / 外部深度文档链接（可选）"), /* @__PURE__ */ React20.createElement(
    "input",
    {
      type: "url",
      value: externalUrl,
      onChange: (e) => setExternalUrl(e.target.value),
      placeholder: "https://xxx.feishu.cn/docx/..."
    }
  ))) : null, tab === "collection" ? /* @__PURE__ */ React20.createElement(React20.Fragment, null, /* @__PURE__ */ React20.createElement("div", { className: "sy-field" }, /* @__PURE__ */ React20.createElement("span", null, "收藏类别"), /* @__PURE__ */ React20.createElement("div", { className: "sy-kind-pills" }, ["github", "x", "web", "image", "music", "video"].map((k) => /* @__PURE__ */ React20.createElement(
    "button",
    {
      type: "button",
      key: k,
      className: kind === k ? "is-on" : "",
      onClick: () => setKind(k)
    },
    KIND_BADGE_LABELS[k]
  )))), /* @__PURE__ */ React20.createElement("div", { className: "sy-form-row2" }, /* @__PURE__ */ React20.createElement("label", { className: "sy-field" }, /* @__PURE__ */ React20.createElement("span", null, "标题 / 名称 *"), /* @__PURE__ */ React20.createElement(
    "input",
    {
      required: true,
      value: title,
      onChange: (e) => setTitle(e.target.value),
      placeholder: kind === "github" ? "owner/repo 仓库名或简介" : "收藏标题"
    }
  )), /* @__PURE__ */ React20.createElement("label", { className: "sy-field" }, /* @__PURE__ */ React20.createElement("span", null, "原始链接 URL"), /* @__PURE__ */ React20.createElement(
    "input",
    {
      type: "url",
      value: url,
      onChange: (e) => setUrl(e.target.value),
      placeholder: "https://..."
    }
  ))), /* @__PURE__ */ React20.createElement("div", { className: "sy-form-row2" }, /* @__PURE__ */ React20.createElement("label", { className: "sy-field" }, /* @__PURE__ */ React20.createElement("span", null, "缩略图 / 封面图 URL（仅存元信息）"), /* @__PURE__ */ React20.createElement(
    "input",
    {
      type: "url",
      value: thumbnail,
      onChange: (e) => setThumbnail(e.target.value),
      placeholder: "https://.../cover.webp"
    }
  )), /* @__PURE__ */ React20.createElement("label", { className: "sy-field" }, /* @__PURE__ */ React20.createElement("span", null, kind === "github" ? "主要语言 (如 TypeScript)" : kind === "x" ? "作者 (@handle)" : "时长 / 创作者"), /* @__PURE__ */ React20.createElement(
    "input",
    {
      value: metaExtra,
      onChange: (e) => setMetaExtra(e.target.value),
      placeholder: kind === "github" ? "Rust / TypeScript" : kind === "x" ? "@karpathy" : "04:32"
    }
  ))), /* @__PURE__ */ React20.createElement("label", { className: "sy-field" }, /* @__PURE__ */ React20.createElement("span", null, "说明信息 / 为什么收藏"), /* @__PURE__ */ React20.createElement(
    "textarea",
    {
      rows: 2,
      value: text,
      onChange: (e) => setText(e.target.value),
      placeholder: "记录一句你的评价、用途或关键信息……"
    }
  )), /* @__PURE__ */ React20.createElement("div", { className: "sy-form-row2" }, /* @__PURE__ */ React20.createElement("label", { className: "sy-field" }, /* @__PURE__ */ React20.createElement("span", null, "标签"), /* @__PURE__ */ React20.createElement("input", { value: tagsText, onChange: (e) => setTagsText(e.target.value), placeholder: "Agent, UI, 必看" })), /* @__PURE__ */ React20.createElement("label", { className: "sy-field" }, /* @__PURE__ */ React20.createElement("span", null, "关联飞书笔记链接（可选）"), /* @__PURE__ */ React20.createElement(
    "input",
    {
      type: "url",
      value: externalUrl,
      onChange: (e) => setExternalUrl(e.target.value),
      placeholder: "https://xxx.feishu.cn/..."
    }
  )))) : null, tab === "task" ? /* @__PURE__ */ React20.createElement(React20.Fragment, null, /* @__PURE__ */ React20.createElement("label", { className: "sy-field" }, /* @__PURE__ */ React20.createElement("span", null, "待办事项标题 *"), /* @__PURE__ */ React20.createElement(
    "input",
    {
      required: true,
      value: title,
      onChange: (e) => setTitle(e.target.value),
      placeholder: "要做什么事？"
    }
  )), /* @__PURE__ */ React20.createElement("div", { className: "sy-form-row3" }, /* @__PURE__ */ React20.createElement("label", { className: "sy-field" }, /* @__PURE__ */ React20.createElement("span", null, "排期日期（留空进待排期 Inbox）"), /* @__PURE__ */ React20.createElement("input", { type: "date", value: due, onChange: (e) => setDue(e.target.value) })), /* @__PURE__ */ React20.createElement("label", { className: "sy-field" }, /* @__PURE__ */ React20.createElement("span", null, "优先级"), /* @__PURE__ */ React20.createElement("select", { value: priority, onChange: (e) => setPriority(e.target.value) }, /* @__PURE__ */ React20.createElement("option", { value: "high" }, "高优先级 (High)"), /* @__PURE__ */ React20.createElement("option", { value: "medium" }, "中优先级 (Medium)"), /* @__PURE__ */ React20.createElement("option", { value: "low" }, "低优先级 (Low)"))), /* @__PURE__ */ React20.createElement("label", { className: "sy-field" }, /* @__PURE__ */ React20.createElement("span", null, "所属项目 (Project)"), /* @__PURE__ */ React20.createElement("input", { value: project, onChange: (e) => setProject(e.target.value), placeholder: "如：核心研发" }))), /* @__PURE__ */ React20.createElement("label", { className: "sy-field" }, /* @__PURE__ */ React20.createElement("span", null, "任务备注说明"), /* @__PURE__ */ React20.createElement("textarea", { rows: 2, value: text, onChange: (e) => setText(e.target.value), placeholder: "补充上下文或验收标准……" }))) : null, tab === "batch" ? /* @__PURE__ */ React20.createElement("label", { className: "sy-field" }, /* @__PURE__ */ React20.createElement("span", null, "粘贴 JSON 数组，或每行一条 CSV（格式：类型,标题,链接,缩略图URL,说明）"), /* @__PURE__ */ React20.createElement(
    "textarea",
    {
      rows: 6,
      required: true,
      value: batchJson,
      onChange: (e) => setBatchJson(e.target.value),
      placeholder: `[
  { "kind": "github", "title": "deepseek-ai/DeepSeek-V3", "url": "https://github.com/deepseek-ai/DeepSeek-V3", "summary": "MLA 与 MoE 架构参考", "tags": ["LLM", "Star"] },
  { "kind": "video", "title": "Bento UI 设计拆解", "url": "https://www.bilibili.com/video/BV1xx", "thumbnail": "https://example.com/cover.jpg", "summary": "卡片排版参考" }
]`
    }
  )) : null, /* @__PURE__ */ React20.createElement("div", { className: "sy-modal-f" }, /* @__PURE__ */ React20.createElement("span", { className: "grow" }), /* @__PURE__ */ React20.createElement("button", { type: "button", className: "sy-btn", onClick: onClose }, "取消"), /* @__PURE__ */ React20.createElement("button", { type: "submit", className: "sy-btn sy-btn-ink", disabled: busy }, busy ? "保存中…" : "保存入库")))));
}
function EntryDetailModal({
  entry,
  onClose,
  onRun
}) {
  const [title, setTitle] = useState4(entry.title);
  const [body, setBody] = useState4(entry.body || (entry.rawNote?.text ?? ""));
  const [thumbnail, setThumbnail] = useState4(entry.thumbnail ?? "");
  const [externalUrl, setExternalUrl] = useState4(entry.externalUrl ?? "");
  const [status, setStatus] = useState4(entry.status || "inbox");
  const [tagsText, setTagsText] = useState4(entry.tags.join(", "));
  const [kind, setKind] = useState4(entry.kind === "note" ? "web" : entry.kind);
  const handleSave = async (e) => {
    e.preventDefault();
    const tags = tagsText.split(/[,，、\s#]+/).map((s) => s.trim()).filter(Boolean).slice(0, 12);
    if (entry.entryType === "note" && entry.rawNote) {
      await onRun(
        "note.update",
        {
          id: entry.rawNote.id,
          title: title.trim() || null,
          text: body.trim() || title.trim(),
          status,
          tags,
          externalUrl: externalUrl.trim() || null
        },
        { toast: "已更新速记备忘" }
      );
    } else {
      const colId = entry.rawCollection?.id || entry.rawFeed?.id;
      await onRun(
        "collection.save",
        {
          id: colId,
          kind,
          status,
          title: title.trim(),
          url: entry.url || void 0,
          thumbnail: thumbnail.trim() || void 0,
          summary: body.trim(),
          externalUrl: externalUrl.trim() || void 0,
          tags,
          meta: entry.meta ?? void 0
        },
        { toast: "已保存收藏元信息" }
      );
    }
    onClose();
  };
  const handleDelete = async () => {
    if (entry.entryType === "note" && entry.rawNote) {
      await onRun("note.remove", { id: entry.rawNote.id }, { toast: "已删除速记" });
    } else if (entry.rawCollection?.id) {
      await onRun("collection.remove", { id: entry.rawCollection.id }, { toast: "已移除收藏" });
    }
    onClose();
  };
  const handleToTask = async () => {
    await onRun(
      "task.add",
      {
        title: title.trim().slice(0, 120),
        note: body.trim().slice(0, 500) || void 0,
        origin: {
          title: title.trim(),
          url: entry.url || entry.externalUrl || void 0,
          source: entry.sourceLabel
        }
      },
      { toast: "已转为待排期任务（Inbox）" }
    );
    onClose();
  };
  return /* @__PURE__ */ React20.createElement("div", { className: "sy-scrim", "data-act": "scrim", onClick: (e) => {
    if (e.target === e.currentTarget) onClose();
  } }, /* @__PURE__ */ React20.createElement("div", { className: "sy-modal sy-capture-modal", role: "dialog", "aria-label": "条目元信息详情" }, /* @__PURE__ */ React20.createElement("div", { className: "sy-modal-h" }, /* @__PURE__ */ React20.createElement("div", null, /* @__PURE__ */ React20.createElement("b", null, KIND_BADGE_LABELS[entry.kind] ?? "元信息", " · 详情与整理"), /* @__PURE__ */ React20.createElement("div", { className: "meta" }, entry.sourceLabel, " ", entry.createdAt ? `· ${relativeTimeShort(entry.createdAt)}` : "")), /* @__PURE__ */ React20.createElement("button", { type: "button", className: "sy-icon-btn", onClick: onClose, "aria-label": "关闭" }, "✕")), /* @__PURE__ */ React20.createElement("form", { className: "sy-modal-b sy-form-stack", onSubmit: handleSave }, thumbnail ? /* @__PURE__ */ React20.createElement("div", { className: "sy-detail-preview" }, /* @__PURE__ */ React20.createElement("img", { src: thumbnail, alt: "", referrerPolicy: "no-referrer" })) : null, /* @__PURE__ */ React20.createElement("div", { className: "sy-form-row2" }, /* @__PURE__ */ React20.createElement("label", { className: "sy-field" }, /* @__PURE__ */ React20.createElement("span", null, "标题"), /* @__PURE__ */ React20.createElement("input", { value: title, onChange: (e) => setTitle(e.target.value), required: true })), /* @__PURE__ */ React20.createElement("label", { className: "sy-field" }, /* @__PURE__ */ React20.createElement("span", null, "整理状态"), /* @__PURE__ */ React20.createElement("select", { value: status, onChange: (e) => setStatus(e.target.value) }, STATUS_OPTIONS.map((opt) => /* @__PURE__ */ React20.createElement("option", { key: opt.value, value: opt.value }, opt.label))))), entry.entryType !== "note" ? /* @__PURE__ */ React20.createElement("div", { className: "sy-form-row2" }, /* @__PURE__ */ React20.createElement("label", { className: "sy-field" }, /* @__PURE__ */ React20.createElement("span", null, "媒介类型"), /* @__PURE__ */ React20.createElement("select", { value: kind, onChange: (e) => setKind(e.target.value) }, ["github", "x", "web", "image", "music", "video", "article"].map((k) => /* @__PURE__ */ React20.createElement("option", { key: k, value: k }, KIND_BADGE_LABELS[k])))), /* @__PURE__ */ React20.createElement("label", { className: "sy-field" }, /* @__PURE__ */ React20.createElement("span", null, "缩略图 URL"), /* @__PURE__ */ React20.createElement(
    "input",
    {
      type: "url",
      value: thumbnail,
      onChange: (e) => setThumbnail(e.target.value),
      placeholder: "https://..."
    }
  ))) : null, /* @__PURE__ */ React20.createElement("label", { className: "sy-field" }, /* @__PURE__ */ React20.createElement("span", null, entry.entryType === "note" ? "速记内容" : "说明信息 / 摘要备注"), /* @__PURE__ */ React20.createElement("textarea", { rows: 3, value: body, onChange: (e) => setBody(e.target.value) })), /* @__PURE__ */ React20.createElement("div", { className: "sy-form-row2" }, /* @__PURE__ */ React20.createElement("label", { className: "sy-field" }, /* @__PURE__ */ React20.createElement("span", null, "标签（逗号分隔）"), /* @__PURE__ */ React20.createElement("input", { value: tagsText, onChange: (e) => setTagsText(e.target.value) })), /* @__PURE__ */ React20.createElement("label", { className: "sy-field" }, /* @__PURE__ */ React20.createElement("span", null, "关联飞书 / 深度笔记链接"), /* @__PURE__ */ React20.createElement(
    "input",
    {
      type: "url",
      value: externalUrl,
      onChange: (e) => setExternalUrl(e.target.value),
      placeholder: "https://xxx.feishu.cn/..."
    }
  ))), /* @__PURE__ */ React20.createElement("div", { className: "sy-modal-f" }, entry.entryType !== "feed" ? /* @__PURE__ */ React20.createElement("button", { type: "button", className: "sy-btn", onClick: handleDelete }, "删除") : null, /* @__PURE__ */ React20.createElement("button", { type: "button", className: "sy-btn", onClick: handleToTask }, "转为排期任务"), entry.url ? /* @__PURE__ */ React20.createElement(
    "a",
    {
      className: "sy-btn",
      href: safeUrl(entry.url),
      target: "_blank",
      rel: "noopener noreferrer"
    },
    "打开原链接 ↗"
  ) : null, externalUrl ? /* @__PURE__ */ React20.createElement(
    "a",
    {
      className: "sy-btn",
      href: safeUrl(externalUrl),
      target: "_blank",
      rel: "noopener noreferrer"
    },
    "打开飞书文档 ↗"
  ) : null, /* @__PURE__ */ React20.createElement("span", { className: "grow" }), /* @__PURE__ */ React20.createElement("button", { type: "submit", className: "sy-btn sy-btn-ink" }, "保存修改")))));
}

// src/client/views/ContentView.tsx
var React21 = __toESM(require("react"), 1);
var { useState: useState5, useMemo: useMemo2 } = React21;
function ContentView({
  notes,
  readLaterEntries,
  bookmarks,
  feedItems,
  onOpenEntry,
  onOpenCapture,
  onRun
}) {
  const [mode, setMode] = useState5("board");
  const [boardGroup, setBoardGroup] = useState5("kind");
  const [kindFilter, setKindFilter] = useState5("all");
  const [search, setSearch] = useState5("");
  const [dragOverCol, setDragOverCol] = useState5(null);
  const [sort, setSort] = useState5({
    key: "createdAt",
    dir: -1
  });
  const allEntries = useMemo2(
    () => buildUnifiedEntries(notes, readLaterEntries, bookmarks, feedItems, false),
    [notes, readLaterEntries, bookmarks, feedItems]
  );
  const filtered = useMemo2(() => {
    const q = search.trim().toLowerCase();
    return allEntries.filter((entry) => {
      if (kindFilter !== "all" && entry.kind !== kindFilter) return false;
      if (!q) return true;
      return [
        entry.title,
        entry.body,
        entry.sourceLabel,
        KIND_BADGE_LABELS[entry.kind],
        ...entry.tags,
        entry.meta?.language,
        entry.meta?.author
      ].some((v) => String(v ?? "").toLowerCase().includes(q));
    });
  }, [allEntries, kindFilter, search]);
  const noteCount = allEntries.filter((e) => e.entryType === "note").length;
  const colCount = allEntries.filter((e) => e.entryType === "collection").length;
  const curatedCount = allEntries.filter((e) => e.status === "curated").length;
  const handleDragStart = (event, entry) => {
    event.dataTransfer.setData("text/sooyo-entry-id", entry.id);
    event.dataTransfer.effectAllowed = "move";
  };
  const handleDropStatus = async (status, event) => {
    event.preventDefault();
    setDragOverCol(null);
    const id = event.dataTransfer.getData("text/sooyo-entry-id");
    const entry = allEntries.find((e) => e.id === id);
    if (!entry || entry.status === status) return;
    if (entry.entryType === "note" && entry.rawNote) {
      await onRun("note.update", { id: entry.rawNote.id, status }, { toast: `已移至「${STATUS_OPTIONS.find((s) => s.value === status)?.label}」` });
    } else if (entry.rawCollection?.id) {
      await onRun(
        "collection.save",
        {
          ...entry.rawCollection,
          id: entry.rawCollection.id,
          status
        },
        { toast: `已移至「${STATUS_OPTIONS.find((s) => s.value === status)?.label}」` }
      );
    }
  };
  const handleQuickTask = (entry) => {
    void onRun(
      "task.add",
      {
        title: entry.title.slice(0, 120),
        origin: { title: entry.title, url: entry.url || void 0, source: entry.sourceLabel }
      },
      { toast: "已加入待排期收件箱（Inbox）" }
    );
  };
  const kindColumns = [
    {
      id: "memo",
      title: "速记与灵感备忘",
      dot: "note",
      rows: filtered.filter((e) => e.kind === "note")
    },
    {
      id: "code-social",
      title: "GitHub Stars & X 收藏",
      dot: "github",
      rows: filtered.filter((e) => e.kind === "github" || e.kind === "x")
    },
    {
      id: "web-article",
      title: "收藏网站与文章",
      dot: "web",
      rows: filtered.filter((e) => e.kind === "web" || e.kind === "article")
    },
    {
      id: "media",
      title: "图片 · 音乐 · 视频元信息",
      dot: "media",
      rows: filtered.filter((e) => e.kind === "image" || e.kind === "music" || e.kind === "video")
    }
  ];
  const sortedTable = useMemo2(() => {
    return [...filtered].sort((a, b) => {
      const av = String(a[sort.key] ?? "");
      const bv = String(b[sort.key] ?? "");
      return av.localeCompare(bv) * sort.dir;
    });
  }, [filtered, sort]);
  return /* @__PURE__ */ React21.createElement("div", { className: "sy-app-page", "data-view": "content" }, /* @__PURE__ */ React21.createElement("header", { className: "sy-view-head" }, /* @__PURE__ */ React21.createElement("div", null, /* @__PURE__ */ React21.createElement("h1", { className: "sy-view-title" }, "内容 · 收藏与速记库"), /* @__PURE__ */ React21.createElement("p", { className: "sy-view-sub" }, `共 ${allEntries.length} 条记录 · ${noteCount} 条速记备忘 · ${colCount} 条多媒介收藏 · ${curatedCount} 条精选常看`)), /* @__PURE__ */ React21.createElement("div", { className: "sy-view-controls" }, /* @__PURE__ */ React21.createElement("label", { className: "sy-search-pill" }, /* @__PURE__ */ React21.createElement("span", null, "⌕"), /* @__PURE__ */ React21.createElement(
    "input",
    {
      value: search,
      onChange: (e) => setSearch(e.target.value),
      placeholder: "搜索标题、说明、标签、GitHub/X…",
      "aria-label": "搜索内容"
    }
  )), /* @__PURE__ */ React21.createElement("div", { className: "sy-seg" }, /* @__PURE__ */ React21.createElement(
    "button",
    {
      type: "button",
      "aria-pressed": mode === "board",
      onClick: () => setMode("board")
    },
    "看板"
  ), /* @__PURE__ */ React21.createElement(
    "button",
    {
      type: "button",
      "aria-pressed": mode === "table",
      onClick: () => setMode("table")
    },
    "表格"
  )), mode === "board" ? /* @__PURE__ */ React21.createElement("div", { className: "sy-seg" }, /* @__PURE__ */ React21.createElement(
    "button",
    {
      type: "button",
      "aria-pressed": boardGroup === "kind",
      onClick: () => setBoardGroup("kind")
    },
    "按媒介"
  ), /* @__PURE__ */ React21.createElement(
    "button",
    {
      type: "button",
      "aria-pressed": boardGroup === "status",
      onClick: () => setBoardGroup("status")
    },
    "按状态"
  )) : null, /* @__PURE__ */ React21.createElement(
    "button",
    {
      type: "button",
      className: "sy-btn",
      onClick: () => onOpenCapture("batch")
    },
    "批量导入"
  ), /* @__PURE__ */ React21.createElement(
    "button",
    {
      type: "button",
      className: "sy-btn sy-btn-ink",
      onClick: () => onOpenCapture("collection")
    },
    "+ 录入收藏 / 速记"
  ))), /* @__PURE__ */ React21.createElement("div", { className: "sy-filter-bar", role: "toolbar", "aria-label": "按媒介类型筛选" }, KIND_FILTER_OPTIONS.map((opt) => /* @__PURE__ */ React21.createElement(
    "button",
    {
      type: "button",
      key: opt.value,
      className: `sy-chip${kindFilter === opt.value ? " is-on" : ""}`,
      onClick: () => setKindFilter(opt.value)
    },
    opt.label
  ))), filtered.length === 0 ? /* @__PURE__ */ React21.createElement("div", { className: "sy-empty-box" }, /* @__PURE__ */ React21.createElement("b", null, search ? "没有匹配的收藏或速记" : "还没有收藏或速记记录"), /* @__PURE__ */ React21.createElement("p", null, "在首页一句话记下备忘灵感，或把你的 GitHub Stars、X 收藏、网站、图片、音视频元信息存进来。"), /* @__PURE__ */ React21.createElement("div", { className: "row", style: { justifyContent: "center", marginTop: 10 } }, /* @__PURE__ */ React21.createElement("button", { type: "button", className: "sy-btn sy-btn-ink", onClick: () => onOpenCapture("collection") }, "+ 录入第一条收藏"), /* @__PURE__ */ React21.createElement("button", { type: "button", className: "sy-btn", onClick: () => onOpenCapture("batch") }, "粘贴 JSON/CSV 批量入库"))) : mode === "board" ? boardGroup === "status" ? /* @__PURE__ */ React21.createElement("div", { className: "sy-kanban-board", "data-cols": "3" }, STATUS_OPTIONS.map((col) => {
    const rows = filtered.filter((e) => e.status === col.value);
    return /* @__PURE__ */ React21.createElement(
      "section",
      {
        key: col.value,
        className: `sy-kanban-col${dragOverCol === col.value ? " is-over" : ""}`,
        onDragOver: (e) => {
          e.preventDefault();
          setDragOverCol(col.value);
        },
        onDragLeave: (e) => {
          if (!e.currentTarget.contains(e.relatedTarget)) setDragOverCol(null);
        },
        onDrop: (e) => void handleDropStatus(col.value, e)
      },
      /* @__PURE__ */ React21.createElement("header", { className: "sy-kanban-head" }, /* @__PURE__ */ React21.createElement("span", { className: `sy-mcard-dot status-${col.value}` }), /* @__PURE__ */ React21.createElement("h3", null, col.label), /* @__PURE__ */ React21.createElement("span", { className: "meta" }, rows.length)),
      /* @__PURE__ */ React21.createElement("div", { className: "sy-kanban-list" }, rows.map((entry) => /* @__PURE__ */ React21.createElement(
        MediaCollectionCard,
        {
          key: entry.id,
          entry,
          draggable: true,
          onDragStart: handleDragStart,
          onOpen: onOpenEntry,
          onQuickTask: handleQuickTask
        }
      )))
    );
  })) : /* @__PURE__ */ React21.createElement("div", { className: "sy-kanban-board", "data-cols": "4" }, kindColumns.map((col) => /* @__PURE__ */ React21.createElement("section", { key: col.id, className: "sy-kanban-col" }, /* @__PURE__ */ React21.createElement("header", { className: "sy-kanban-head" }, /* @__PURE__ */ React21.createElement("span", { className: `sy-mcard-dot kind-${col.dot}` }), /* @__PURE__ */ React21.createElement("h3", null, col.title), /* @__PURE__ */ React21.createElement("span", { className: "meta" }, col.rows.length)), /* @__PURE__ */ React21.createElement("div", { className: "sy-kanban-list" }, col.rows.map((entry) => /* @__PURE__ */ React21.createElement(
    MediaCollectionCard,
    {
      key: entry.id,
      entry,
      onOpen: onOpenEntry,
      onQuickTask: handleQuickTask
    }
  )))))) : /* @__PURE__ */ React21.createElement("div", { className: "sy-table-wrap" }, /* @__PURE__ */ React21.createElement("table", { className: "sy-data-table" }, /* @__PURE__ */ React21.createElement("thead", null, /* @__PURE__ */ React21.createElement("tr", null, /* @__PURE__ */ React21.createElement("th", null, /* @__PURE__ */ React21.createElement(
    "button",
    {
      type: "button",
      onClick: () => setSort((s) => ({ key: "title", dir: s.key === "title" ? s.dir === 1 ? -1 : 1 : 1 }))
    },
    "标题与说明"
  )), /* @__PURE__ */ React21.createElement("th", null, /* @__PURE__ */ React21.createElement(
    "button",
    {
      type: "button",
      onClick: () => setSort((s) => ({ key: "kind", dir: s.key === "kind" ? s.dir === 1 ? -1 : 1 : 1 }))
    },
    "类别 / 来源"
  )), /* @__PURE__ */ React21.createElement("th", null, /* @__PURE__ */ React21.createElement(
    "button",
    {
      type: "button",
      onClick: () => setSort((s) => ({ key: "status", dir: s.key === "status" ? s.dir === 1 ? -1 : 1 : 1 }))
    },
    "状态"
  )), /* @__PURE__ */ React21.createElement("th", null, "标签 / 元信息"), /* @__PURE__ */ React21.createElement("th", null, "链接 / 飞书"), /* @__PURE__ */ React21.createElement("th", null, /* @__PURE__ */ React21.createElement(
    "button",
    {
      type: "button",
      onClick: () => setSort((s) => ({ key: "createdAt", dir: s.key === "createdAt" ? s.dir === 1 ? -1 : 1 : -1 }))
    },
    "记录于"
  )))), /* @__PURE__ */ React21.createElement("tbody", null, sortedTable.map((entry) => /* @__PURE__ */ React21.createElement("tr", { key: entry.id, onClick: () => onOpenEntry(entry), tabIndex: 0 }, /* @__PURE__ */ React21.createElement("td", { className: "sy-td-main" }, /* @__PURE__ */ React21.createElement("span", { className: "sy-td-thumb" }, entry.thumbnail ? /* @__PURE__ */ React21.createElement("img", { src: entry.thumbnail, alt: "", loading: "lazy", referrerPolicy: "no-referrer" }) : /* @__PURE__ */ React21.createElement("span", null, entry.title.slice(0, 1))), /* @__PURE__ */ React21.createElement("div", null, /* @__PURE__ */ React21.createElement("strong", null, entry.title), entry.body ? /* @__PURE__ */ React21.createElement("small", null, entry.body.slice(0, 90)) : null)), /* @__PURE__ */ React21.createElement("td", null, /* @__PURE__ */ React21.createElement("span", { className: `sy-mcard-pill kind-${entry.kind}` }, KIND_BADGE_LABELS[entry.kind] ?? entry.kind), /* @__PURE__ */ React21.createElement("div", { className: "meta" }, entry.sourceLabel)), /* @__PURE__ */ React21.createElement("td", null, /* @__PURE__ */ React21.createElement("span", { className: `sy-status-pill status-${entry.status}` }, STATUS_OPTIONS.find((s) => s.value === entry.status)?.label ?? entry.status)), /* @__PURE__ */ React21.createElement("td", null, /* @__PURE__ */ React21.createElement("div", { className: "sy-mcard-tags" }, entry.tags.map((t) => /* @__PURE__ */ React21.createElement("span", { key: t, className: "sy-mcard-tag" }, "#", t)), entry.meta?.language ? /* @__PURE__ */ React21.createElement("span", { className: "sy-mcard-meta-tag" }, entry.meta.language) : null, entry.meta?.stars ? /* @__PURE__ */ React21.createElement("span", { className: "sy-mcard-meta-tag" }, "★ ", entry.meta.stars) : null)), /* @__PURE__ */ React21.createElement("td", { onClick: (e) => e.stopPropagation() }, /* @__PURE__ */ React21.createElement("div", { className: "row" }, entry.url ? /* @__PURE__ */ React21.createElement("a", { className: "sy-mini-act", href: safeUrl(entry.url), target: "_blank", rel: "noopener noreferrer" }, "源链 ↗") : null, entry.externalUrl ? /* @__PURE__ */ React21.createElement(
    "a",
    {
      className: "sy-mini-act",
      href: safeUrl(entry.externalUrl),
      target: "_blank",
      rel: "noopener noreferrer"
    },
    "飞书 ↗"
  ) : null)), /* @__PURE__ */ React21.createElement("td", { className: "meta" }, relativeTimeShort(entry.createdAt) || "—")))))));
}

// src/client/views/RetroView.tsx
var React22 = __toESM(require("react"), 1);
var { useState: useState6, useMemo: useMemo3, useEffect: useEffect3 } = React22;
function currentWeekKey(today) {
  const date = /* @__PURE__ */ new Date(`${today}T00:00:00`);
  const jan1 = new Date(date.getFullYear(), 0, 1);
  const days = Math.floor((date.getTime() - jan1.getTime()) / 864e5);
  const week = Math.ceil((days + jan1.getDay() + 1) / 7);
  return `${date.getFullYear()}-W${String(week).padStart(2, "0")}`;
}
function isoDayOffset(baseIso, deltaDays) {
  const date = /* @__PURE__ */ new Date(`${baseIso.slice(0, 10)}T12:00:00`);
  date.setDate(date.getDate() + deltaDays);
  return toDayKey(date);
}
function TrendChart({
  points
}) {
  const [hoverIdx, setHoverIdx] = useState6(null);
  const width = 460;
  const height = 170;
  const padL = 26;
  const padR = 12;
  const padT = 16;
  const padB = 26;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;
  const maxVal = Math.max(4, ...points.map((point) => point.total));
  const stepX = points.length > 1 ? innerW / (points.length - 1) : innerW;
  const coords = points.map((point, index) => ({
    x: padL + index * stepX,
    y: padT + innerH - point.total / maxVal * innerH,
    yTask: padT + innerH - point.tasks / maxVal * innerH,
    ...point
  }));
  const linePath = coords.map((pt, index) => `${index === 0 ? "M" : "L"}${pt.x.toFixed(1)},${pt.y.toFixed(1)}`).join(" ");
  const lastCoord = coords[coords.length - 1];
  const firstCoord = coords[0];
  const areaPath = lastCoord && firstCoord ? `${linePath} L${lastCoord.x.toFixed(1)},${(padT + innerH).toFixed(1)} L${firstCoord.x.toFixed(1)},${(padT + innerH).toFixed(1)} Z` : "";
  const hovered = hoverIdx !== null ? coords[hoverIdx] : lastCoord;
  return /* @__PURE__ */ React22.createElement("div", { className: "sy-chart-wrap" }, hovered ? /* @__PURE__ */ React22.createElement("div", { className: "sy-chart-stat" }, /* @__PURE__ */ React22.createElement("span", { className: "mono" }, hovered.date.slice(5)), /* @__PURE__ */ React22.createElement("span", null, "完成 ", /* @__PURE__ */ React22.createElement("b", null, hovered.tasks), " 项 · 收录/速记 ", /* @__PURE__ */ React22.createElement("b", null, hovered.captures), " 条")) : null, /* @__PURE__ */ React22.createElement(
    "svg",
    {
      className: "sy-chart",
      viewBox: `0 0 ${width} ${height}`,
      onMouseLeave: () => setHoverIdx(null)
    },
    /* @__PURE__ */ React22.createElement("defs", null, /* @__PURE__ */ React22.createElement("linearGradient", { id: "syRetroGrad", x1: "0", y1: "0", x2: "0", y2: "1" }, /* @__PURE__ */ React22.createElement("stop", { offset: "0%", stopColor: "var(--sy-accent)", stopOpacity: "0.28" }), /* @__PURE__ */ React22.createElement("stop", { offset: "100%", stopColor: "var(--sy-accent)", stopOpacity: "0.0" }))),
    [0, 0.5, 1].map((ratio, idx) => {
      const y = padT + innerH * (1 - ratio);
      const val = Math.round(maxVal * ratio);
      return /* @__PURE__ */ React22.createElement("g", { key: idx }, /* @__PURE__ */ React22.createElement(
        "line",
        {
          x1: padL,
          x2: width - padR,
          y1: y,
          y2: y,
          stroke: "var(--sy-line)",
          strokeDasharray: ratio === 0 ? void 0 : "3 3"
        }
      ), /* @__PURE__ */ React22.createElement(
        "text",
        {
          x: padL - 6,
          y: y + 3,
          textAnchor: "end",
          fontSize: "10",
          fill: "var(--sy-ink3)",
          fontFamily: "var(--sy-mono)"
        },
        val
      ));
    }),
    areaPath ? /* @__PURE__ */ React22.createElement("path", { d: areaPath, fill: "url(#syRetroGrad)" }) : null,
    linePath ? /* @__PURE__ */ React22.createElement(
      "path",
      {
        d: linePath,
        fill: "none",
        stroke: "var(--sy-accent)",
        strokeWidth: "2.2",
        strokeLinecap: "round",
        strokeLinejoin: "round"
      }
    ) : null,
    coords.map((pt, index) => /* @__PURE__ */ React22.createElement(
      "g",
      {
        key: pt.date,
        onMouseEnter: () => setHoverIdx(index),
        style: { cursor: "pointer" }
      },
      /* @__PURE__ */ React22.createElement(
        "rect",
        {
          x: pt.x - stepX / 2,
          y: padT,
          width: Math.max(12, stepX),
          height: innerH,
          fill: "transparent"
        }
      ),
      /* @__PURE__ */ React22.createElement(
        "circle",
        {
          cx: pt.x,
          cy: pt.y,
          r: hoverIdx === index ? 4.5 : 2.8,
          fill: hoverIdx === index ? "var(--sy-accent)" : "var(--sy-card)",
          stroke: "var(--sy-accent)",
          strokeWidth: "2"
        }
      ),
      index % 3 === 0 || index === coords.length - 1 ? /* @__PURE__ */ React22.createElement(
        "text",
        {
          x: pt.x,
          y: height - 6,
          textAnchor: "middle",
          fontSize: "10",
          fill: "var(--sy-ink3)",
          fontFamily: "var(--sy-mono)"
        },
        pt.date.slice(5)
      ) : null
    ))
  ));
}
function RetroView({
  daily,
  items,
  onRun,
  onNavigate,
  onOpenEntry
}) {
  const today = toDayKey(/* @__PURE__ */ new Date());
  const [period, setPeriod] = useState6("week");
  const [trendMode, setTrendMode] = useState6("chart");
  const periodKey = useMemo3(() => {
    if (period === "day") return today;
    if (period === "week") return currentWeekKey(today);
    return today.slice(0, 7);
  }, [period, today]);
  const existingRetro = daily?.retros?.[periodKey];
  const [highlights, setHighlights] = useState6("");
  const [blockers, setBlockers] = useState6("");
  const [nextFocus, setNextFocus] = useState6("");
  useEffect3(() => {
    setHighlights(existingRetro?.highlights ?? "");
    setBlockers(existingRetro?.blockers ?? "");
    setNextFocus(existingRetro?.nextFocus ?? "");
  }, [periodKey, existingRetro?.updatedAt]);
  const dayMap = useMemo3(
    () => buildDayFootprintMap(
      daily?.notes ?? [],
      daily?.tasks ?? [],
      daily?.readLaterEntries ?? {},
      daily?.retros ?? {}
    ),
    [daily?.notes, daily?.tasks, daily?.readLaterEntries, daily?.retros]
  );
  const streak = useMemo3(() => computeActiveStreak(dayMap), [dayMap]);
  const entries = useMemo3(
    () => buildUnifiedEntries(
      daily?.notes ?? [],
      daily?.readLaterEntries ?? {},
      daily?.bookmarks ?? [],
      items,
      false
    ),
    [daily?.notes, daily?.readLaterEntries, daily?.bookmarks, items]
  );
  const tasks = daily?.tasks ?? [];
  const habits = daily?.habits ?? [];
  const proposals = daily?.agentInbox ?? [];
  const rangeDays = period === "day" ? 1 : period === "week" ? 7 : 30;
  const cutoffIso = isoDayOffset(today, -(rangeDays - 1));
  const periodStats = useMemo3(() => {
    let completedCount = 0;
    let createdNotesAndCollections = 0;
    for (let offset = -(rangeDays - 1); offset <= 0; offset += 1) {
      const date = isoDayOffset(today, offset);
      const list = dayMap.get(date) ?? [];
      for (const item of list) {
        if (item.kind === "task") completedCount += 1;
        if (item.kind === "note" || item.kind === "collection") createdNotesAndCollections += 1;
      }
    }
    const openTodayOrOverdue = tasks.filter(
      (task) => !task.done && (task.list === "today" || task.due && task.due <= today)
    );
    const activeProjects = /* @__PURE__ */ new Map();
    for (const task of tasks) {
      const proj = task.project?.trim() || "未分类日常";
      const cur = activeProjects.get(proj) ?? { total: 0, done: 0 };
      cur.total += 1;
      if (task.done) cur.done += 1;
      activeProjects.set(proj, cur);
    }
    const sortedProjects = [...activeProjects.entries()].sort((a, b) => b[1].total - a[1].total);
    const kindCounts = /* @__PURE__ */ new Map();
    for (const entry of entries) {
      if (entry.createdAt.slice(0, 10) >= cutoffIso || period !== "day") {
        kindCounts.set(entry.kind, (kindCounts.get(entry.kind) ?? 0) + 1);
      }
    }
    return {
      completedCount,
      createdNotesAndCollections,
      openTodayOrOverdue,
      sortedProjects,
      kindCounts,
      focusMin: daily?.focus?.totalMinutesToday ?? daily?.focus?.minutes ?? 0
    };
  }, [
    rangeDays,
    today,
    dayMap,
    tasks,
    entries,
    cutoffIso,
    period,
    daily?.focus?.totalMinutesToday,
    daily?.focus?.minutes
  ]);
  const trendPoints = useMemo3(() => {
    const out = [];
    for (let offset = -13; offset <= 0; offset += 1) {
      const date = isoDayOffset(today, offset);
      const list = dayMap.get(date) ?? [];
      const t = list.filter((item) => item.kind === "task").length;
      const c = list.filter((item) => item.kind === "note" || item.kind === "collection").length;
      out.push({
        date,
        tasks: t,
        captures: c,
        total: list.length
      });
    }
    return out;
  }, [dayMap, today]);
  const topProjectName = periodStats.sortedProjects[0]?.[0] ?? "日常事项";
  const recentHighlights = useMemo3(() => entries.slice(0, 3), [entries]);
  const handleSaveRetro = (event) => {
    event.preventDefault();
    void onRun(
      "retro.save",
      {
        key: periodKey,
        period,
        highlights: highlights.trim(),
        blockers: blockers.trim(),
        nextFocus: nextFocus.trim()
      },
      { toast: `已保存「${periodKey}」个人复盘` }
    );
  };
  const handleRolloverOpenTasks = async () => {
    for (const task of periodStats.openTodayOrOverdue) {
      await onRun("task.update", { id: task.id, due: today, list: "today" });
    }
  };
  const handleNextFocusToTask = () => {
    const firstLine = nextFocus.split(/\r?\n/).map((line) => line.replace(/^[-*•\d.\s]+/, "").trim()).find(Boolean);
    if (!firstLine) return;
    void onRun(
      "task.add",
      { title: firstLine.slice(0, 80), list: "today", due: today, priority: "high" },
      { toast: `已加入今日排期：${firstLine.slice(0, 24)}` }
    );
  };
  return /* @__PURE__ */ React22.createElement("div", { className: "sy-view-retro", "data-view": "retro" }, /* @__PURE__ */ React22.createElement("div", { className: "sy-view-toolbar" }, /* @__PURE__ */ React22.createElement("div", { className: "sy-view-toolbar-left" }, /* @__PURE__ */ React22.createElement("div", { className: "sy-seg sm", role: "tablist", "aria-label": "复盘周期" }, /* @__PURE__ */ React22.createElement(
    "button",
    {
      type: "button",
      role: "tab",
      "aria-selected": period === "day",
      onClick: () => setPeriod("day")
    },
    "今日复盘"
  ), /* @__PURE__ */ React22.createElement(
    "button",
    {
      type: "button",
      role: "tab",
      "aria-selected": period === "week",
      onClick: () => setPeriod("week")
    },
    "本周复盘"
  ), /* @__PURE__ */ React22.createElement(
    "button",
    {
      type: "button",
      role: "tab",
      "aria-selected": period === "month",
      onClick: () => setPeriod("month")
    },
    "本月复盘"
  )), /* @__PURE__ */ React22.createElement("span", { className: "meta" }, `周期标识：${periodKey} · 连续活跃 ${streak} 天`)), /* @__PURE__ */ React22.createElement("div", { className: "sy-view-toolbar-right" }, periodStats.openTodayOrOverdue.length > 0 ? /* @__PURE__ */ React22.createElement(
    "button",
    {
      type: "button",
      className: "sy-btn",
      onClick: () => void handleRolloverOpenTasks()
    },
    `顺延 ${periodStats.openTodayOrOverdue.length} 项未完待办到今天`
  ) : null, /* @__PURE__ */ React22.createElement(
    "button",
    {
      type: "button",
      className: "sy-btn",
      onClick: () => onNavigate("schedule")
    },
    "打开排期日历 →"
  ))), /* @__PURE__ */ React22.createElement("div", { className: "sy-retro-grid" }, /* @__PURE__ */ React22.createElement("section", { className: "sy-retro-tile sy-retro-hero" }, /* @__PURE__ */ React22.createElement("div", null, /* @__PURE__ */ React22.createElement("div", { className: "sy-retro-eyebrow" }, period === "day" ? "DAILY RETROSPECTIVE · 今日小结" : period === "week" ? "WEEKLY RETROSPECTIVE · 本周复盘" : "MONTHLY RETROSPECTIVE · 月度复盘"), /* @__PURE__ */ React22.createElement("h2", { className: "sy-retro-title" }, period === "day" ? "今天" : period === "week" ? "最近 7 天" : "最近 30 天", "共完成了", " ", /* @__PURE__ */ React22.createElement("em", null, periodStats.completedCount, " 项任务"), "，收录了", " ", /* @__PURE__ */ React22.createElement("b", null, periodStats.createdNotesAndCollections, " 条灵感与偏好收藏"), "；重心集中在「", /* @__PURE__ */ React22.createElement("b", null, topProjectName), "」，当前还有", " ", /* @__PURE__ */ React22.createElement("b", null, periodStats.openTodayOrOverdue.length, " 项今日待办"), "等待收尾。")), /* @__PURE__ */ React22.createElement("div", { className: "sy-retro-metrics" }, /* @__PURE__ */ React22.createElement("div", { className: "sy-retro-metric" }, /* @__PURE__ */ React22.createElement("span", { className: "num" }, periodStats.completedCount), /* @__PURE__ */ React22.createElement("span", { className: "lbl" }, "已完成任务")), /* @__PURE__ */ React22.createElement("div", { className: "sy-retro-metric" }, /* @__PURE__ */ React22.createElement("span", { className: "num" }, periodStats.focusMin), /* @__PURE__ */ React22.createElement("span", { className: "lbl" }, "今日专注分钟")), /* @__PURE__ */ React22.createElement("div", { className: "sy-retro-metric" }, /* @__PURE__ */ React22.createElement("span", { className: "num" }, entries.length), /* @__PURE__ */ React22.createElement("span", { className: "lbl" }, "偏好与速记总数")), /* @__PURE__ */ React22.createElement("div", { className: "sy-retro-metric" }, /* @__PURE__ */ React22.createElement("span", { className: "num" }, `${streak}d`), /* @__PURE__ */ React22.createElement("span", { className: "lbl" }, "连续记录天数")))), /* @__PURE__ */ React22.createElement("section", { className: "sy-retro-tile sy-retro-trend" }, /* @__PURE__ */ React22.createElement("div", { className: "sy-retro-tile-h" }, /* @__PURE__ */ React22.createElement("div", null, /* @__PURE__ */ React22.createElement("h3", null, "近 14 日节奏曲线"), /* @__PURE__ */ React22.createElement("span", { className: "meta" }, "任务完成 + 灵感与收藏收录")), /* @__PURE__ */ React22.createElement("div", { className: "sy-seg sm" }, /* @__PURE__ */ React22.createElement(
    "button",
    {
      type: "button",
      "aria-selected": trendMode === "chart",
      onClick: () => setTrendMode("chart")
    },
    "图"
  ), /* @__PURE__ */ React22.createElement(
    "button",
    {
      type: "button",
      "aria-selected": trendMode === "table",
      onClick: () => setTrendMode("table")
    },
    "表"
  ))), trendMode === "chart" ? /* @__PURE__ */ React22.createElement(TrendChart, { points: trendPoints }) : /* @__PURE__ */ React22.createElement("div", { className: "sy-retro-mini-table" }, trendPoints.slice().reverse().slice(0, 6).map((row) => /* @__PURE__ */ React22.createElement("div", { key: row.date, className: "sy-retro-mini-row" }, /* @__PURE__ */ React22.createElement("span", { className: "mono" }, row.date), /* @__PURE__ */ React22.createElement("span", null, `完成 ${row.tasks} · 收录 ${row.captures}`), /* @__PURE__ */ React22.createElement("b", { className: "mono" }, row.total))))), /* @__PURE__ */ React22.createElement("section", { className: "sy-retro-tile sy-retro-dist" }, /* @__PURE__ */ React22.createElement("div", { className: "sy-retro-tile-h" }, /* @__PURE__ */ React22.createElement("div", null, /* @__PURE__ */ React22.createElement("h3", null, "项目推进与收藏构成"), /* @__PURE__ */ React22.createElement("span", { className: "meta" }, "工作进度与输入偏好分布"))), /* @__PURE__ */ React22.createElement("div", { className: "sy-dist-list" }, /* @__PURE__ */ React22.createElement("div", { className: "sy-dist-subhead" }, "项目完成度"), periodStats.sortedProjects.slice(0, 3).map(([proj, stat]) => {
    const pct = stat.total > 0 ? Math.round(stat.done / stat.total * 100) : 0;
    return /* @__PURE__ */ React22.createElement("div", { key: proj, className: "sy-dist-row" }, /* @__PURE__ */ React22.createElement("div", { className: "sy-dist-label" }, /* @__PURE__ */ React22.createElement("b", null, proj), /* @__PURE__ */ React22.createElement("span", { className: "mono" }, `${stat.done}/${stat.total} (${pct}%)`)), /* @__PURE__ */ React22.createElement("div", { className: "sy-dist-bar" }, /* @__PURE__ */ React22.createElement("i", { style: { width: `${pct}%` } })));
  }), /* @__PURE__ */ React22.createElement("div", { className: "sy-dist-subhead", style: { marginTop: 8 } }, "偏好内容分布"), ["note", "github", "x", "video", "web"].map((kind) => {
    const count = periodStats.kindCounts.get(kind) ?? 0;
    const pct = entries.length > 0 ? Math.round(count / entries.length * 100) : 0;
    const label = KIND_BADGE_LABELS[kind] ?? kind;
    return /* @__PURE__ */ React22.createElement("div", { key: kind, className: "sy-dist-row" }, /* @__PURE__ */ React22.createElement("div", { className: "sy-dist-label" }, /* @__PURE__ */ React22.createElement("span", null, label), /* @__PURE__ */ React22.createElement("span", { className: "mono" }, `${count} 条`)), /* @__PURE__ */ React22.createElement("div", { className: "sy-dist-bar" }, /* @__PURE__ */ React22.createElement("i", { style: { width: `${Math.max(pct, count > 0 ? 8 : 0)}%` } })));
  }), habits.length > 0 ? /* @__PURE__ */ React22.createElement(React22.Fragment, null, /* @__PURE__ */ React22.createElement("div", { className: "sy-dist-subhead", style: { marginTop: 8 } }, "习惯打卡"), /* @__PURE__ */ React22.createElement("div", { className: "sy-chips" }, habits.map((habit) => {
    const doneToday = habit.lastTickDate === today;
    return /* @__PURE__ */ React22.createElement(
      "button",
      {
        key: habit.id,
        type: "button",
        className: "sy-chipbtn",
        "aria-pressed": doneToday,
        "data-act": "habit-tick",
        "data-habit": habit.id
      },
      `${doneToday ? "✓ " : ""}${habit.name} (${habit.streak ?? 0}d)`
    );
  }))) : null)), /* @__PURE__ */ React22.createElement("section", { className: "sy-retro-tile sy-retro-reflect" }, /* @__PURE__ */ React22.createElement("div", { className: "sy-retro-tile-h" }, /* @__PURE__ */ React22.createElement("div", null, /* @__PURE__ */ React22.createElement("h3", null, "个人复盘手记 · ", periodKey), /* @__PURE__ */ React22.createElement("span", { className: "meta" }, "沉淀关键收获，飞书长文可贴在内容库"))), /* @__PURE__ */ React22.createElement("form", { className: "sy-retro-form", onSubmit: handleSaveRetro }, /* @__PURE__ */ React22.createElement("label", { className: "sy-fld" }, /* @__PURE__ */ React22.createElement("span", null, "✨ 本期高光与关键产出"), /* @__PURE__ */ React22.createElement(
    "textarea",
    {
      name: "retro-highlights",
      value: highlights,
      onChange: (event) => setHighlights(event.target.value),
      rows: 2,
      placeholder: "这周/今天最有价值的一件事是什么？"
    }
  )), /* @__PURE__ */ React22.createElement("label", { className: "sy-fld" }, /* @__PURE__ */ React22.createElement("span", null, "🚧 卡点与精力复盘"), /* @__PURE__ */ React22.createElement(
    "textarea",
    {
      name: "retro-blockers",
      value: blockers,
      onChange: (event) => setBlockers(event.target.value),
      rows: 2,
      placeholder: "哪里拖慢了节奏？下次如何规避？"
    }
  )), /* @__PURE__ */ React22.createElement("label", { className: "sy-fld" }, /* @__PURE__ */ React22.createElement("span", null, "🎯 下一阶段聚焦（可一键转待办）"), /* @__PURE__ */ React22.createElement(
    "textarea",
    {
      name: "retro-next-focus",
      value: nextFocus,
      onChange: (event) => setNextFocus(event.target.value),
      rows: 2,
      placeholder: "写下接下来最重要的一件事..."
    }
  )), /* @__PURE__ */ React22.createElement("div", { className: "sy-retro-form-foot" }, nextFocus.trim() ? /* @__PURE__ */ React22.createElement(
    "button",
    {
      type: "button",
      className: "sy-btn",
      onClick: handleNextFocusToTask
    },
    "转为今日任务"
  ) : null, /* @__PURE__ */ React22.createElement("button", { type: "submit", className: "sy-btn sy-btn-ink", "data-act": "retro-save" }, "保存复盘记录"))), recentHighlights.length > 0 ? /* @__PURE__ */ React22.createElement("div", { className: "sy-retro-recent" }, /* @__PURE__ */ React22.createElement("div", { className: "sy-dist-subhead" }, "最新收录与闪念"), recentHighlights.map((entry) => /* @__PURE__ */ React22.createElement(
    "button",
    {
      key: entry.id,
      type: "button",
      className: "sy-retro-recent-item",
      onClick: () => onOpenEntry(entry)
    },
    /* @__PURE__ */ React22.createElement("span", { className: "badge" }, KIND_BADGE_LABELS[entry.kind] ?? entry.kind),
    /* @__PURE__ */ React22.createElement("span", { className: "c1" }, entry.title)
  ))) : null), /* @__PURE__ */ React22.createElement("section", { className: "sy-retro-tile sy-retro-advice" }, /* @__PURE__ */ React22.createElement("div", { className: "sy-retro-tile-h" }, /* @__PURE__ */ React22.createElement("div", null, /* @__PURE__ */ React22.createElement("h3", null, "Agent 复盘建议与行动"), /* @__PURE__ */ React22.createElement("span", { className: "meta" }, "基于当前待办、收藏与复盘提议"))), /* @__PURE__ */ React22.createElement("div", { className: "sy-advice-list" }, proposals.map((proposal) => {
    const applied = proposal.status === "applied";
    return /* @__PURE__ */ React22.createElement("div", { key: proposal.id, className: "sy-advice-card" }, /* @__PURE__ */ React22.createElement("div", { className: "sy-advice-top" }, /* @__PURE__ */ React22.createElement("span", { className: "sy-pill" }, applied ? "已生效" : "Agent 提议"), /* @__PURE__ */ React22.createElement("b", null, proposal.reason)), /* @__PURE__ */ React22.createElement("div", { className: "sy-advice-acts" }, applied ? /* @__PURE__ */ React22.createElement(
      "button",
      {
        type: "button",
        className: "sy-btn",
        "data-act": "proposal-rollback",
        "data-proposal": proposal.id
      },
      "撤销改动"
    ) : /* @__PURE__ */ React22.createElement(React22.Fragment, null, /* @__PURE__ */ React22.createElement(
      "button",
      {
        type: "button",
        className: "sy-btn sy-btn-ink",
        "data-act": "proposal-approve",
        "data-proposal": proposal.id
      },
      "采纳并执行"
    ), /* @__PURE__ */ React22.createElement(
      "button",
      {
        type: "button",
        className: "sy-btn",
        "data-act": "proposal-reject",
        "data-proposal": proposal.id
      },
      "忽略"
    ))));
  }), /* @__PURE__ */ React22.createElement("div", { className: "sy-advice-card" }, /* @__PURE__ */ React22.createElement("div", { className: "sy-advice-top" }, /* @__PURE__ */ React22.createElement("span", { className: "sy-pill" }, "智能洞察"), /* @__PURE__ */ React22.createElement("b", null, periodStats.openTodayOrOverdue.length > 0 ? `今日还有 ${periodStats.openTodayOrOverdue.length} 项待办未收尾` : "今日排期已全部清空")), /* @__PURE__ */ React22.createElement("p", null, periodStats.openTodayOrOverdue[0] ? `建议优先完成「${periodStats.openTodayOrOverdue[0].title}」，或进入排期日历拖拽调整日期。` : "可以前往「内容」库整理近期收藏的 GitHub Stars、X 书签与视频，或开启下一轮专注。"), /* @__PURE__ */ React22.createElement("div", { className: "sy-advice-acts" }, /* @__PURE__ */ React22.createElement(
    "button",
    {
      type: "button",
      className: "sy-btn",
      onClick: () => onNavigate(periodStats.openTodayOrOverdue.length > 0 ? "schedule" : "content")
    },
    periodStats.openTodayOrOverdue.length > 0 ? "去排期日历调整 →" : "去内容库整理收藏 →"
  )))))));
}

// src/client/views/ScheduleView.tsx
var React23 = __toESM(require("react"), 1);
var { useState: useState7, useMemo: useMemo4 } = React23;
var MONTHS_EN = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December"
];
var WEEK_HEADERS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
var DRAG_TASK_MIME = "text/sooyo-task-id";
var PRIORITY_LABELS = {
  high: "高优",
  medium: "中优",
  low: "低优"
};
function TaskDetailModal({
  task,
  onClose,
  onRun
}) {
  const [title, setTitle] = useState7(task.title);
  const [due, setDue] = useState7(task.due ? task.due.slice(0, 10) : "");
  const [priority, setPriority] = useState7(task.priority ?? "");
  const [project, setProject] = useState7(task.project ?? "");
  const [note, setNote] = useState7(task.note ?? "");
  const [subtasks, setSubtasks] = useState7(Array.isArray(task.subtasks) ? task.subtasks : []);
  const [newSub, setNewSub] = useState7("");
  const addSubtask = () => {
    const t = newSub.trim();
    if (!t) return;
    setSubtasks((prev) => [...prev, { id: `sub-${Date.now().toString(36)}`, title: t, done: false }]);
    setNewSub("");
  };
  const handleSave = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    await onRun(
      "task.update",
      {
        id: task.id,
        title: title.trim(),
        due: due || null,
        priority: priority || null,
        project: project.trim() || "",
        note: note.trim(),
        subtasks
      },
      { toast: "已更新任务排期与详情" }
    );
    onClose();
  };
  const handleDelete = async () => {
    await onRun("task.remove", { id: task.id }, { toast: "已删除任务" });
    onClose();
  };
  return /* @__PURE__ */ React23.createElement("div", { className: "sy-scrim", "data-act": "scrim", onClick: (e) => {
    if (e.target === e.currentTarget) onClose();
  } }, /* @__PURE__ */ React23.createElement("div", { className: "sy-modal sy-capture-modal", role: "dialog", "aria-label": "任务排期与详情" }, /* @__PURE__ */ React23.createElement("div", { className: "sy-modal-h" }, /* @__PURE__ */ React23.createElement("div", null, /* @__PURE__ */ React23.createElement("b", null, "任务排期与子步骤"), /* @__PURE__ */ React23.createElement("div", { className: "meta" }, due ? `已排期至 ${due}` : "未排期（位于收件箱 Inbox）", task.origin?.url ? ` · 来源：${task.origin.source || task.origin.title || "外链"}` : "")), /* @__PURE__ */ React23.createElement("button", { type: "button", className: "sy-icon-btn", onClick: onClose, "aria-label": "关闭" }, "✕")), /* @__PURE__ */ React23.createElement("form", { className: "sy-modal-b sy-form-stack", onSubmit: handleSave }, /* @__PURE__ */ React23.createElement("label", { className: "sy-field" }, /* @__PURE__ */ React23.createElement("span", null, "任务标题"), /* @__PURE__ */ React23.createElement("input", { value: title, onChange: (e) => setTitle(e.target.value), required: true })), /* @__PURE__ */ React23.createElement("div", { className: "sy-form-row3" }, /* @__PURE__ */ React23.createElement("label", { className: "sy-field" }, /* @__PURE__ */ React23.createElement("span", null, "排期日期（清空则回 Inbox）"), /* @__PURE__ */ React23.createElement("input", { type: "date", value: due, onChange: (e) => setDue(e.target.value) })), /* @__PURE__ */ React23.createElement("label", { className: "sy-field" }, /* @__PURE__ */ React23.createElement("span", null, "优先级"), /* @__PURE__ */ React23.createElement("select", { value: priority, onChange: (e) => setPriority(e.target.value) }, /* @__PURE__ */ React23.createElement("option", { value: "" }, "无优先级"), /* @__PURE__ */ React23.createElement("option", { value: "high" }, "高优先级 (High)"), /* @__PURE__ */ React23.createElement("option", { value: "medium" }, "中优先级 (Medium)"), /* @__PURE__ */ React23.createElement("option", { value: "low" }, "低优先级 (Low)"))), /* @__PURE__ */ React23.createElement("label", { className: "sy-field" }, /* @__PURE__ */ React23.createElement("span", null, "所属项目 (Project)"), /* @__PURE__ */ React23.createElement("input", { value: project, onChange: (e) => setProject(e.target.value), placeholder: "如：插件重构" }))), /* @__PURE__ */ React23.createElement("label", { className: "sy-field" }, /* @__PURE__ */ React23.createElement("span", null, "备注说明"), /* @__PURE__ */ React23.createElement(
    "textarea",
    {
      rows: 2,
      value: note,
      onChange: (e) => setNote(e.target.value),
      placeholder: "记录执行要点、上下文或相关链接……"
    }
  )), /* @__PURE__ */ React23.createElement("div", { className: "sy-field" }, /* @__PURE__ */ React23.createElement("span", null, "子步骤清单 (", subtasks.filter((s) => s.done).length, "/", subtasks.length, ")"), /* @__PURE__ */ React23.createElement("div", { className: "sy-subtask-list" }, subtasks.map((sub, idx) => /* @__PURE__ */ React23.createElement("div", { key: sub.id, className: "sy-subtask-row" }, /* @__PURE__ */ React23.createElement(
    "input",
    {
      type: "checkbox",
      checked: sub.done,
      onChange: () => setSubtasks((prev) => prev.map((s, i) => i === idx ? { ...s, done: !s.done } : s))
    }
  ), /* @__PURE__ */ React23.createElement("span", { className: sub.done ? "is-done" : "" }, sub.title), /* @__PURE__ */ React23.createElement(
    "button",
    {
      type: "button",
      className: "sy-mini-act",
      onClick: () => setSubtasks((prev) => prev.filter((_, i) => i !== idx))
    },
    "✕"
  ))), /* @__PURE__ */ React23.createElement("div", { className: "sy-subtask-add" }, /* @__PURE__ */ React23.createElement(
    "input",
    {
      value: newSub,
      onChange: (e) => setNewSub(e.target.value),
      placeholder: "添加子步骤，按加号确认",
      onKeyDown: (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          addSubtask();
        }
      }
    }
  ), /* @__PURE__ */ React23.createElement("button", { type: "button", className: "sy-btn", onClick: addSubtask }, "+ 添加步骤")))), /* @__PURE__ */ React23.createElement("div", { className: "sy-modal-f" }, /* @__PURE__ */ React23.createElement("button", { type: "button", className: "sy-btn", onClick: handleDelete }, "删除任务"), /* @__PURE__ */ React23.createElement(
    "button",
    {
      type: "button",
      className: "sy-btn",
      onClick: async () => {
        await onRun("task.update", { id: task.id, done: !task.done });
        onClose();
      }
    },
    task.done ? "标记为未完成" : "✓ 标记完成"
  ), /* @__PURE__ */ React23.createElement("span", { className: "grow" }), /* @__PURE__ */ React23.createElement("button", { type: "button", className: "sy-btn", onClick: onClose }, "取消"), /* @__PURE__ */ React23.createElement("button", { type: "submit", className: "sy-btn sy-btn-ink" }, "保存排期")))));
}
function ScheduleView({
  tasks,
  dayMap,
  initialFocusDay,
  onCaptureToday,
  onRun
}) {
  const todayKey = toDayKey(/* @__PURE__ */ new Date());
  const [calMode, setCalMode] = useState7("month");
  const [cursor, setCursor] = useState7(() => {
    if (initialFocusDay && /^\d{4}-\d{2}-\d{2}/.test(initialFocusDay)) {
      const d = /* @__PURE__ */ new Date(`${initialFocusDay.slice(0, 10)}T12:00:00`);
      if (!Number.isNaN(d.getTime())) return new Date(d.getFullYear(), d.getMonth(), 1);
    }
    const now = /* @__PURE__ */ new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDay, setSelectedDay] = useState7(initialFocusDay || todayKey);
  const [dragOverCell, setDragOverCell] = useState7(null);
  const [dragOverTray, setDragOverTray] = useState7(false);
  const [editingTask, setEditingTask] = useState7(null);
  const [inboxDraft, setInboxDraft] = useState7("");
  const [dayDraft, setDayDraft] = useState7("");
  const y = cursor.getFullYear();
  const m = cursor.getMonth();
  const monthPrefix = `${y}-${String(m + 1).padStart(2, "0")}`;
  const cells = useMemo4(() => {
    if (calMode === "week") {
      const anchor = selectedDay ? /* @__PURE__ */ new Date(`${selectedDay}T12:00:00`) : /* @__PURE__ */ new Date();
      const start = new Date(anchor);
      start.setDate(anchor.getDate() - anchor.getDay());
      return Array.from({ length: 7 }, (_, i) => {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        return d;
      });
    }
    const firstDow = new Date(y, m, 1).getDay();
    const raw = [];
    for (let i = 0; i < 42; i += 1) raw.push(new Date(y, m, i - firstDow + 1));
    if (raw[28] && raw[28].getMonth() !== m) return raw.slice(0, 28);
    if (raw[35] && raw[35].getMonth() === m) return raw;
    return raw.slice(0, 35);
  }, [calMode, y, m, selectedDay]);
  const tasksByDay = useMemo4(() => {
    const map = /* @__PURE__ */ new Map();
    const pRank = { high: 0, medium: 1, low: 2 };
    for (const task of tasks) {
      const effectiveDay = task.due ? task.due.slice(0, 10) : task.list === "today" ? todayKey : null;
      if (!effectiveDay) continue;
      const arr = map.get(effectiveDay) ?? [];
      arr.push(task);
      map.set(effectiveDay, arr);
    }
    for (const list of map.values()) {
      list.sort((a, b) => {
        if (a.done !== b.done) return a.done ? 1 : -1;
        return (pRank[a.priority ?? ""] ?? 3) - (pRank[b.priority ?? ""] ?? 3);
      });
    }
    return map;
  }, [tasks, todayKey]);
  const unscheduledInbox = useMemo4(
    () => tasks.filter((t) => !t.due && t.list === "inbox" && !t.done),
    [tasks]
  );
  const todayAndOverdue = useMemo4(
    () => tasks.filter((t) => !t.done && (t.list === "today" || t.due && t.due.slice(0, 10) <= todayKey)).sort((a, b) => {
      const pRank = { high: 0, medium: 1, low: 2 };
      return (pRank[a.priority ?? ""] ?? 3) - (pRank[b.priority ?? ""] ?? 3);
    }),
    [tasks, todayKey]
  );
  const nextFocusTask = todayAndOverdue[0] ?? tasks.find((t) => !t.done && t.due && t.due >= todayKey) ?? null;
  const streak = useMemo4(() => computeActiveStreak(dayMap), [dayMap]);
  const monthScheduledCount = useMemo4(
    () => [...tasksByDay.entries()].filter(([k]) => k.startsWith(monthPrefix)).reduce((sum, [, list]) => sum + list.length, 0),
    [tasksByDay, monthPrefix]
  );
  const monthDoneCount = useMemo4(
    () => tasks.filter(
      (t) => t.done && (t.due && t.due.startsWith(monthPrefix) || t.completedAt && t.completedAt.startsWith(monthPrefix))
    ).length,
    [tasks, monthPrefix]
  );
  const startDragTask = (event, taskId) => {
    event.dataTransfer.setData(DRAG_TASK_MIME, taskId);
    event.dataTransfer.effectAllowed = "move";
  };
  const scheduleTaskToDate = async (taskId, dayKeyStr) => {
    await onRun(
      "task.update",
      {
        id: taskId,
        due: dayKeyStr,
        list: dayKeyStr <= todayKey ? "today" : "later"
      },
      { toast: dayKeyStr === todayKey ? "已排期到今天" : `已排期至 ${dayKeyStr}` }
    );
  };
  const unscheduleTaskToInbox = async (taskId) => {
    await onRun(
      "task.update",
      { id: taskId, due: null, list: "inbox" },
      { toast: "已取消排期，移回待排期收件箱" }
    );
  };
  const handleAddInbox = async (e) => {
    e.preventDefault();
    const val = inboxDraft.trim();
    if (!val) return;
    setInboxDraft("");
    await onRun("task.add", { title: val, list: "inbox" }, { toast: "已加入待排期收件箱" });
  };
  const handleAddOnSelectedDay = async (e) => {
    e.preventDefault();
    const val = dayDraft.trim();
    if (!val) return;
    setDayDraft("");
    await onRun(
      "task.add",
      {
        title: val,
        due: selectedDay,
        list: selectedDay <= todayKey ? "today" : "later"
      },
      { toast: `已排期至 ${selectedDay}` }
    );
  };
  const selectedDayTasks = tasksByDay.get(selectedDay) ?? [];
  return /* @__PURE__ */ React23.createElement("div", { className: "sy-app-page", "data-view": "schedule" }, /* @__PURE__ */ React23.createElement("div", { className: "sy-schedule-layout" }, /* @__PURE__ */ React23.createElement("section", { className: "sy-cal-tile" }, /* @__PURE__ */ React23.createElement("header", { className: "sy-cal-head" }, /* @__PURE__ */ React23.createElement("div", { className: "sy-cal-num" }, String(m + 1).padStart(2, "0")), /* @__PURE__ */ React23.createElement("div", { className: "sy-cal-month" }, /* @__PURE__ */ React23.createElement("span", null, y), /* @__PURE__ */ React23.createElement("em", null, MONTHS_EN[m])), /* @__PURE__ */ React23.createElement("dl", { className: "sy-cal-stats" }, /* @__PURE__ */ React23.createElement("div", null, /* @__PURE__ */ React23.createElement("dt", null, "连续记录"), /* @__PURE__ */ React23.createElement("dd", null, streak, /* @__PURE__ */ React23.createElement("small", null, "天"))), /* @__PURE__ */ React23.createElement("div", null, /* @__PURE__ */ React23.createElement("dt", null, "本月排期"), /* @__PURE__ */ React23.createElement("dd", null, monthScheduledCount, /* @__PURE__ */ React23.createElement("small", null, "项"))), /* @__PURE__ */ React23.createElement("div", null, /* @__PURE__ */ React23.createElement("dt", null, "本月完成"), /* @__PURE__ */ React23.createElement("dd", null, monthDoneCount, /* @__PURE__ */ React23.createElement("small", null, "项")))), /* @__PURE__ */ React23.createElement("span", { className: "grow" }), /* @__PURE__ */ React23.createElement("div", { className: "sy-seg" }, /* @__PURE__ */ React23.createElement(
    "button",
    {
      type: "button",
      "aria-pressed": calMode === "month",
      onClick: () => setCalMode("month")
    },
    "月历"
  ), /* @__PURE__ */ React23.createElement(
    "button",
    {
      type: "button",
      "aria-pressed": calMode === "week",
      onClick: () => setCalMode("week")
    },
    "周视图"
  )), /* @__PURE__ */ React23.createElement(
    "button",
    {
      type: "button",
      className: "sy-icon-btn",
      "aria-label": "上个月",
      onClick: () => setCursor(new Date(y, m - 1, 1))
    },
    "‹"
  ), /* @__PURE__ */ React23.createElement(
    "button",
    {
      type: "button",
      className: "sy-btn",
      onClick: () => {
        const now = /* @__PURE__ */ new Date();
        setCursor(new Date(now.getFullYear(), now.getMonth(), 1));
        setSelectedDay(todayKey);
      }
    },
    "今天"
  ), /* @__PURE__ */ React23.createElement(
    "button",
    {
      type: "button",
      className: "sy-icon-btn",
      "aria-label": "下个月",
      onClick: () => setCursor(new Date(y, m + 1, 1))
    },
    "›"
  )), /* @__PURE__ */ React23.createElement("div", { className: "sy-cal-weeks" }, WEEK_HEADERS.map((w) => /* @__PURE__ */ React23.createElement("span", { key: w }, w))), /* @__PURE__ */ React23.createElement(
    "div",
    {
      className: `sy-cal-grid${calMode === "week" ? " is-week" : ""}`,
      role: "grid",
      style: { "--cal-rows": Math.max(1, cells.length / 7) }
    },
    cells.map((date) => {
      const key = toDayKey(date);
      const dayTasks = tasksByDay.get(key) ?? [];
      const stamps = dayMap.get(key);
      const isToday = key === todayKey;
      const isSelected = key === selectedDay;
      const isOutside = calMode === "month" && date.getMonth() !== m;
      const maxShow = calMode === "week" ? 8 : 3;
      return /* @__PURE__ */ React23.createElement(
        "div",
        {
          key,
          role: "gridcell",
          "data-day": key,
          className: `sy-cal-cell${isOutside ? " is-outside" : ""}${isToday ? " is-today" : ""}${isSelected ? " is-selected" : ""}${dragOverCell === key ? " is-over" : ""}`,
          onClick: () => setSelectedDay(key),
          onDragOver: (e) => {
            e.preventDefault();
            setDragOverCell(key);
          },
          onDragLeave: (e) => {
            if (!e.currentTarget.contains(e.relatedTarget)) {
              setDragOverCell((cur) => cur === key ? null : cur);
            }
          },
          onDrop: (e) => {
            e.preventDefault();
            setDragOverCell(null);
            const taskId = e.dataTransfer.getData(DRAG_TASK_MIME);
            if (taskId) void scheduleTaskToDate(taskId, key);
          }
        },
        /* @__PURE__ */ React23.createElement("div", { className: "sy-cal-cell-top" }, /* @__PURE__ */ React23.createElement("span", { className: "sy-cal-date" }, date.getDate(), isToday ? /* @__PURE__ */ React23.createElement("small", null, "今日") : null), stamps?.length || isToday ? /* @__PURE__ */ React23.createElement("div", { className: "sy-cal-stamp", onClick: (e) => e.stopPropagation() }, /* @__PURE__ */ React23.createElement(
          Stamp,
          {
            list: stamps,
            today: isToday,
            label: `${date.getMonth() + 1}月${date.getDate()}日`,
            onCaptureToday,
            onOpen: () => setSelectedDay(key)
          }
        )) : null),
        /* @__PURE__ */ React23.createElement("div", { className: "sy-cal-tasks", onClick: (e) => e.stopPropagation() }, dayTasks.slice(0, maxShow).map((task) => {
          const subDone = (task.subtasks ?? []).filter((s) => s.done).length;
          const subTotal = (task.subtasks ?? []).length;
          return /* @__PURE__ */ React23.createElement(
            "div",
            {
              key: task.id,
              className: `sy-cal-chip${task.done ? " is-done" : ""} prio-${task.priority || "none"}`,
              draggable: true,
              onDragStart: (e) => startDragTask(e, task.id),
              onClick: () => setEditingTask(task),
              title: task.title
            },
            /* @__PURE__ */ React23.createElement(
              "button",
              {
                type: "button",
                className: `sy-chk${task.done ? " on" : ""}`,
                "aria-label": task.done ? "标记未完成" : "标记完成",
                onClick: (e) => {
                  e.stopPropagation();
                  void onRun("task.update", { id: task.id, done: !task.done });
                }
              }
            ),
            /* @__PURE__ */ React23.createElement("span", { className: "sy-cal-chip-title" }, task.title),
            subTotal > 0 ? /* @__PURE__ */ React23.createElement("small", { className: "sy-cal-chip-sub" }, subDone, "/", subTotal) : null
          );
        }), dayTasks.length > maxShow ? /* @__PURE__ */ React23.createElement(
          "button",
          {
            type: "button",
            className: "sy-cal-more",
            onClick: () => setSelectedDay(key)
          },
          "还有 ",
          dayTasks.length - maxShow,
          " 项"
        ) : null)
      );
    })
  ), /* @__PURE__ */ React23.createElement("div", { className: "sy-day-agenda" }, /* @__PURE__ */ React23.createElement("div", { className: "sy-day-agenda-head" }, /* @__PURE__ */ React23.createElement("b", null, selectedDay === todayKey ? `今日日程 (${selectedDay})` : `${selectedDay} 排期事项`), /* @__PURE__ */ React23.createElement("span", { className: "meta" }, "共 ", selectedDayTasks.length, " 项任务 · 点击任务可编辑优先级与子步骤")), /* @__PURE__ */ React23.createElement("form", { className: "sy-day-add-form", onSubmit: handleAddOnSelectedDay }, /* @__PURE__ */ React23.createElement(
    "input",
    {
      value: dayDraft,
      onChange: (e) => setDayDraft(e.target.value),
      placeholder: `在 ${selectedDay} 新建一项排期任务，回车保存…`,
      "aria-label": `在 ${selectedDay} 新建排期任务`
    }
  ), /* @__PURE__ */ React23.createElement("button", { type: "submit", className: "sy-btn sy-btn-ink", disabled: !dayDraft.trim() }, "+ 排入当天")), selectedDayTasks.length > 0 ? /* @__PURE__ */ React23.createElement("div", { className: "sy-day-agenda-list" }, selectedDayTasks.map((task) => /* @__PURE__ */ React23.createElement("div", { key: task.id, className: `sy-agenda-item${task.done ? " is-done" : ""}` }, /* @__PURE__ */ React23.createElement(
    "button",
    {
      type: "button",
      className: `sy-chk${task.done ? " on" : ""}`,
      onClick: () => void onRun("task.update", { id: task.id, done: !task.done })
    }
  ), /* @__PURE__ */ React23.createElement("div", { className: "sy-agenda-main", onClick: () => setEditingTask(task) }, /* @__PURE__ */ React23.createElement("b", null, task.title), task.note ? /* @__PURE__ */ React23.createElement("p", null, task.note) : null), task.priority ? /* @__PURE__ */ React23.createElement("span", { className: `sy-prio-badge prio-${task.priority}` }, PRIORITY_LABELS[task.priority] ?? task.priority) : null, task.project ? /* @__PURE__ */ React23.createElement("span", { className: "sy-pill" }, task.project) : null, /* @__PURE__ */ React23.createElement("button", { type: "button", className: "sy-mini-act", onClick: () => setEditingTask(task) }, "详情")))) : null)), /* @__PURE__ */ React23.createElement("aside", { className: "sy-schedule-rail" }, nextFocusTask ? /* @__PURE__ */ React23.createElement("div", { className: "sy-next-card", onClick: () => setEditingTask(nextFocusTask), role: "button", tabIndex: 0 }, /* @__PURE__ */ React23.createElement("div", { className: "sy-next-top" }, /* @__PURE__ */ React23.createElement("span", null, "今日聚焦 · 下一件事"), /* @__PURE__ */ React23.createElement("span", null, nextFocusTask.due || "今天")), /* @__PURE__ */ React23.createElement("strong", { className: "sy-next-title" }, nextFocusTask.title), nextFocusTask.note ? /* @__PURE__ */ React23.createElement("p", { className: "sy-next-note" }, nextFocusTask.note) : null, /* @__PURE__ */ React23.createElement("div", { className: "sy-next-foot", onClick: (e) => e.stopPropagation() }, /* @__PURE__ */ React23.createElement("span", null, nextFocusTask.project ? `${nextFocusTask.project} · ` : "", nextFocusTask.priority ? `${PRIORITY_LABELS[nextFocusTask.priority]} · ` : "", todayAndOverdue.length, " 项今日待办"), /* @__PURE__ */ React23.createElement(
    "button",
    {
      type: "button",
      className: "sy-btn sy-btn-ink",
      onClick: () => void onRun("task.update", { id: nextFocusTask.id, done: true }, { toast: "已完成今日聚焦事项" })
    },
    "✓ 完成"
  ))) : /* @__PURE__ */ React23.createElement("div", { className: "sy-next-card is-calm" }, /* @__PURE__ */ React23.createElement("div", { className: "sy-next-top" }, /* @__PURE__ */ React23.createElement("span", null, "今日聚焦"), /* @__PURE__ */ React23.createElement("span", null, todayKey)), /* @__PURE__ */ React23.createElement("strong", { className: "sy-next-title" }, "今天的排期已经全部清空"), /* @__PURE__ */ React23.createElement("p", { className: "sy-next-note" }, "可以从下方待排期收件箱把任务拖到日历任意一天。")), /* @__PURE__ */ React23.createElement(
    "section",
    {
      className: `sy-inbox-tray${dragOverTray ? " is-over" : ""}`,
      "aria-label": "待排期收件箱",
      onDragOver: (e) => {
        e.preventDefault();
        setDragOverTray(true);
      },
      onDragLeave: (e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setDragOverTray(false);
      },
      onDrop: (e) => {
        e.preventDefault();
        setDragOverTray(false);
        const taskId = e.dataTransfer.getData(DRAG_TASK_MIME);
        if (taskId) void unscheduleTaskToInbox(taskId);
      }
    },
    /* @__PURE__ */ React23.createElement("header", { className: "sy-tray-head" }, /* @__PURE__ */ React23.createElement("div", null, /* @__PURE__ */ React23.createElement("h2", null, "待排期 · Inbox (", unscheduledInbox.length, ")"), /* @__PURE__ */ React23.createElement("span", { className: "meta" }, "拖到左侧日历即可排期；从日历拖回此处取消排期"))),
    /* @__PURE__ */ React23.createElement("form", { className: "sy-tray-add", onSubmit: handleAddInbox }, /* @__PURE__ */ React23.createElement(
      "input",
      {
        value: inboxDraft,
        onChange: (e) => setInboxDraft(e.target.value),
        placeholder: "先记下待办，稍后再拖上日历排期…",
        "aria-label": "新建待排期任务"
      }
    ), /* @__PURE__ */ React23.createElement("button", { type: "submit", className: "sy-btn", disabled: !inboxDraft.trim() }, "+ 记入")),
    /* @__PURE__ */ React23.createElement("div", { className: "sy-tray-scroll" }, unscheduledInbox.length === 0 ? /* @__PURE__ */ React23.createElement("p", { className: "meta", style: { padding: "16px 4px", textAlign: "center" } }, "收件箱为空，所有待办均已排入日历。") : unscheduledInbox.map((task) => /* @__PURE__ */ React23.createElement(
      "div",
      {
        key: task.id,
        className: `sy-tray-item prio-${task.priority || "none"}`,
        draggable: true,
        onDragStart: (e) => startDragTask(e, task.id),
        onClick: () => setEditingTask(task)
      },
      /* @__PURE__ */ React23.createElement("span", { className: "sy-drag-grip", "aria-hidden": "true" }, "⋮⋮"),
      /* @__PURE__ */ React23.createElement("div", { className: "sy-tray-item-body" }, /* @__PURE__ */ React23.createElement("b", null, task.title), /* @__PURE__ */ React23.createElement("small", null, task.project ? `#${task.project} · ` : "", task.priority ? PRIORITY_LABELS[task.priority] : "待排期")),
      /* @__PURE__ */ React23.createElement(
        "button",
        {
          type: "button",
          className: "sy-mini-act",
          title: "排到今天",
          onClick: (e) => {
            e.stopPropagation();
            void scheduleTaskToDate(task.id, todayKey);
          }
        },
        "今天"
      )
    )))
  ))), editingTask ? /* @__PURE__ */ React23.createElement(
    TaskDetailModal,
    {
      task: editingTask,
      onClose: () => setEditingTask(null),
      onRun
    }
  ) : null);
}

// sooyo-css:./styles/tokens.css
var tokens_default = CSS;

// src/client/SooyoPanel.tsx
var { useState: useState8, useEffect: useEffect4, useRef: useRef2, useCallback: useCallback2, useMemo: useMemo5 } = React24;
function InlineHeadlineIcon({ name, rotated, text }) {
  const [hidden, setHidden] = useState8(false);
  return /* @__PURE__ */ React24.createElement("span", { className: "sy-nw" }, !hidden ? /* @__PURE__ */ React24.createElement(
    "img",
    {
      className: `sy-hi${rotated ? " r" : ""}`,
      src: `${ASSET}/${name}.webp`,
      alt: "",
      onError: () => setHidden(true)
    }
  ) : null, /* @__PURE__ */ React24.createElement("b", null, text));
}
function SooyoPanel() {
  const state = useDaily();
  const rootRef = useRef2(null);
  const gridRef = useRef2(null);
  const [cols, setCols] = useState8(12);
  const [appView, setAppView] = useState8("home");
  const [homeMode, setHomeMode] = useState8("bento");
  const [homeKindFilter, setHomeKindFilter] = useState8("all");
  const [heroInput, setHeroInput] = useState8("");
  const [heroCaptureMode, setHeroCaptureMode] = useState8("auto");
  const [captureModalTab, setCaptureModalTab] = useState8(null);
  const [activeEntryDetail, setActiveEntryDetail] = useState8(null);
  const [scheduleFocusDay, setScheduleFocusDay] = useState8(null);
  const [editing, setEditing] = useState8(false);
  const [modal, setModal] = useState8(null);
  const [menu, setMenu] = useState8(null);
  const [deck, setDeck] = useState8({
    index: {},
    flipped: {}
  });
  const [query, setQuery] = useState8("");
  const [cmdOpen, setCmdOpen] = useState8(false);
  const [theme, setTheme] = useState8("light");
  const daily = state.daily;
  const widgets = daily?.widgets ?? {};
  const types = daily?.types ?? {};
  const boards = daily?.boards ?? [];
  const activeBoard = daily?.active ?? boards[0]?.id ?? null;
  const layout = activeBoard ? daily?.layouts?.[activeBoard]?.[cols] ?? daily?.layouts?.[activeBoard]?.[12] ?? [] : [];
  useEffect4(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return void 0;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const stored = (() => {
      try {
        return window.localStorage.getItem("sooyo:theme");
      } catch {
        return null;
      }
    })();
    const sync = () => setTheme(stored ?? (media.matches ? "dark" : "light"));
    sync();
    media.addEventListener?.("change", sync);
    return () => media.removeEventListener?.("change", sync);
  }, []);
  useEffect4(() => {
    if (rootRef.current) rootRef.current.scrollTop = 0;
    if (typeof window !== "undefined") window.scrollTo(0, 0);
  }, [appView]);
  useEffect4(() => {
    const element = gridRef.current;
    if (!element || typeof ResizeObserver === "undefined") return void 0;
    const apply = () => setCols(columnsFor(gridRef.current?.clientWidth || element.clientWidth || 1200));
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(element);
    return () => observer.disconnect();
  }, [daily, appView, homeMode]);
  const byId = useMemo5(() => {
    const map = /* @__PURE__ */ new Map();
    for (const [id, snap] of Object.entries(daily?.readLaterEntries ?? {})) {
      if (snap && typeof snap === "object") map.set(id, snap);
    }
    for (const item of state.items) map.set(item.id, item);
    return map;
  }, [state.items, daily?.readLaterEntries]);
  const saved = useMemo5(() => new Set(daily?.readLater ?? []), [daily?.readLater]);
  const dayMap = useDayFootprintMap(
    daily?.notes ?? [],
    daily?.tasks ?? [],
    daily?.readLaterEntries ?? {},
    daily?.retros ?? {}
  );
  const unifiedEntries = useMemo5(
    () => buildUnifiedEntries(
      daily?.notes ?? [],
      daily?.readLaterEntries ?? {},
      daily?.bookmarks ?? [],
      state.items,
      false
    ),
    [daily?.notes, daily?.readLaterEntries, daily?.bookmarks, state.items]
  );
  const filteredHomeEntries = useMemo5(() => {
    return unifiedEntries.filter((entry) => {
      if (homeKindFilter !== "all" && entry.kind !== homeKindFilter) return false;
      return entry.status !== "archived";
    });
  }, [unifiedEntries, homeKindFilter]);
  const relatedHeroEntries = useMemo5(() => {
    const q = heroInput.trim().toLowerCase();
    if (q.length < 2) return [];
    return unifiedEntries.filter(
      (entry) => entry.title.toLowerCase().includes(q) || entry.body.toLowerCase().includes(q) || entry.tags.some((t) => t.toLowerCase().includes(q))
    ).slice(0, 3);
  }, [heroInput, unifiedEntries]);
  const layoutSizes = useMemo5(() => {
    const map = {};
    for (const entry of layout) map[entry.id] = entry.size;
    return map;
  }, [layout]);
  const context = useMemo5(
    () => ({
      items: state.items,
      byId,
      saved,
      tasks: daily?.tasks ?? [],
      notes: daily?.notes ?? [],
      readLater: daily?.readLater ?? [],
      readLaterEntries: daily?.readLaterEntries ?? {},
      interests: daily?.interests ?? [],
      bookmarks: daily?.bookmarks ?? [],
      habits: daily?.habits ?? [],
      focus: daily?.focus ?? null,
      sources: daily?.sources ?? [],
      agentInbox: daily?.agentInbox ?? [],
      types,
      cols,
      layoutSizes,
      deckIndex: deck.index,
      deckFlipped: deck.flipped,
      sizesOf: (type) => sizeOrder.filter((size) => Boolean(types[type]?.sizes?.[size]))
    }),
    [state.items, byId, saved, daily, types, cols, layoutSizes, deck]
  );
  const positions = useMemo5(() => pack(types, widgets, layout, cols), [types, widgets, layout, cols]);
  const decide = useCallback2(
    async (proposalId, decision) => {
      if (!proposalId) return;
      try {
        const proposal = (daily?.agentInbox ?? []).find((entry) => entry.id === proposalId);
        const precondition = Number.isSafeInteger(proposal?.revision) ? { entity: "proposal", id: proposal.id, revision: proposal.revision } : void 0;
        const result = await api("/agent-inbox/decide", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            id: proposalId,
            decision,
            ...precondition ? { precondition } : {}
          })
        });
        if (result?.ok === false) {
          state.setToast({ text: String(result.error ?? "这条建议没有处理成功") });
        } else if (decision === "approve") {
          const applied = result?.applied;
          const failed = Array.isArray(applied) ? applied.filter((entry) => !entry.ok) : applied?.failed ?? [];
          state.setToast({
            text: failed.length > 0 || applied?.ok === false ? `已批准，但执行失败：${String(failed[0]?.error ?? applied?.error ?? "未知原因")}` : "已批准并执行"
          });
        } else if (decision === "rollback") {
          state.setToast({ text: "已撤销这条提议的改动" });
        } else {
          state.setToast({ text: "已拒绝这条建议" });
        }
      } catch (failure) {
        state.setToast({ text: String(failure?.message ?? failure) });
      }
      await state.reload();
    },
    [state, daily?.agentInbox]
  );
  const deckItemsOf = useCallback2(
    (widget) => {
      const list = subItemsOf(widget, state.items, daily?.interests ?? []);
      return list.slice(0, DECK_SIZE);
    },
    [state.items, daily?.interests]
  );
  const stepDeck = useCallback2(
    (widgetId, delta) => {
      if (!widgetId) return;
      const widget = widgets[widgetId];
      if (!widget) return;
      const list = deckItemsOf(widget);
      const total = list.length;
      if (total === 0) return;
      setDeck((current) => {
        const index = current.index[widgetId] ?? 0;
        const next = Math.max(0, Math.min(total - 1, index + delta));
        const leaving = list[index];
        if (leaving && delta > 0) void action("item.state", { ids: [leaving.id], seen: true }).catch(() => {
        });
        return { ...current, index: { ...current.index, [widgetId]: next } };
      });
    },
    [widgets, deckItemsOf]
  );
  const currentDeckItem = useCallback2(
    (widgetId) => {
      if (!widgetId) return null;
      const widget = widgets[widgetId];
      if (!widget) return null;
      const list = deckItemsOf(widget);
      return list[Math.min(deck.index[widgetId] ?? 0, Math.max(0, list.length - 1))] ?? null;
    },
    [widgets, deckItemsOf, deck.index]
  );
  const addWidget = useCallback2(
    (type, size, settings, title) => {
      void state.run(
        "widget.add",
        { type, size, settings, title, boardId: activeBoard },
        { toast: `已添加「${types[type]?.name ?? type}」` }
      );
    },
    [state, activeBoard, types]
  );
  const setSize = useCallback2(
    (widgetId, size) => {
      if (!widgetId || !size) return;
      void state.run("widget.resize", { id: widgetId, size, cols, boardId: activeBoard });
    },
    [state, cols, activeBoard]
  );
  const removeWidget = useCallback2(
    (widgetId) => {
      if (!widgetId) return;
      void state.run("widget.remove", { id: widgetId }, { toast: "已移除这个 Widget" });
    },
    [state]
  );
  const duplicateWidget = useCallback2(
    (widgetId) => {
      if (!widgetId) return;
      void state.run("widget.duplicate", { id: widgetId, boardId: activeBoard }, { toast: "已复制" });
    },
    [state, activeBoard]
  );
  const toggleLater = useCallback2(
    (itemId, forceOff) => {
      if (!itemId) return;
      const on = saved.has(itemId);
      void state.run(
        "readlater.set",
        { itemId, on: forceOff ? false : !on },
        { toast: on || forceOff ? "已移出稍后读" : "已存到稍后读" }
      );
    },
    [state, saved]
  );
  const itemToTask = useCallback2(
    (itemId) => {
      if (!itemId) return;
      const item = byId.get(itemId);
      if (!item) return;
      void state.run(
        "item.toTask",
        {
          title: item.title.length > 60 ? `${item.title.slice(0, 59)}…` : item.title,
          origin: { source: item.sourceLabel ?? "", url: item.url ?? "" }
        },
        { toast: `已转为任务，放进收件箱 · 出处：${item.sourceLabel ?? ""}` }
      );
    },
    [state, byId]
  );
  const itemToNote = useCallback2(
    (itemId) => {
      if (!itemId) return;
      const item = byId.get(itemId);
      if (!item) return;
      void state.run(
        "item.toNote",
        {
          title: item.title,
          origin: { source: item.sourceLabel ?? "", url: item.url ?? "" }
        },
        { toast: `已转为 Note · 出处：${item.sourceLabel ?? ""}` }
      );
    },
    [state, byId]
  );
  const onRootClick = useCallback2(
    (event) => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target) return;
      if (menu && !target.closest(".sy-pop") && !target.closest('[data-act="w-menu"]') && !target.closest('[data-act="board-new"]')) {
        setMenu(null);
      }
      const opened = target.closest("a[data-open]");
      if (opened?.dataset.open) {
        void action("item.state", { ids: [opened.dataset.open], seen: true }).catch(() => {
        });
      }
      const element = target.closest("[data-act]");
      if (!element) return;
      const act = element.dataset.act;
      const ds = element.dataset;
      switch (act) {
        case "app-view":
          if (ds.view === "home" || ds.view === "content" || ds.view === "schedule" || ds.view === "retro") {
            setAppView(ds.view);
            setEditing(false);
          }
          break;
        case "capture-modal-open":
          setCaptureModalTab(
            ds.tab ?? "note"
          );
          break;
        case "board":
          setAppView("home");
          void state.run("board.active", { id: ds.board });
          break;
        case "board-new": {
          const rect = element.getBoundingClientRect();
          setMenu({ kind: "board-new", rect });
          break;
        }
        case "edit-toggle":
          setEditing((value) => !value);
          break;
        case "gallery-open":
          setModal({ kind: "gallery", type: "subscription", size: "M", sources: ["aihot"], pres: null });
          break;
        case "w-menu": {
          const rect = element.getBoundingClientRect();
          setMenu({ kind: "w-menu", id: ds.w, rect });
          break;
        }
        case "w-size":
          setMenu(null);
          setSize(ds.w, ds.size);
          break;
        case "w-dup":
          setMenu(null);
          duplicateWidget(ds.w);
          break;
        case "w-remove":
          setMenu(null);
          removeWidget(ds.w);
          break;
        case "w-settings":
          setMenu(null);
          if (ds.w) setModal({ kind: "settings", id: ds.w });
          break;
        case "w-refresh":
          setMenu(null);
          void state.refreshSources();
          break;
        case "task-toggle":
          void state.run("task.update", {
            id: ds.task,
            done: !daily?.tasks?.find((task) => task.id === ds.task)?.done
          });
          break;
        case "task-today":
          void state.run("task.update", { id: ds.task, list: "today" }, { toast: "已移到今天" });
          break;
        case "task-remove":
          void state.run("task.remove", { id: ds.task }, { toast: "已删除" });
          break;
        case "note-remove":
          void state.run("note.remove", { id: ds.note }, { toast: "已删除" });
          break;
        case "habit-tick":
          void state.run("habit.tick", { id: ds.habit });
          break;
        case "item-later":
          toggleLater(ds.item, ds.off === "1");
          break;
        case "item-task":
          itemToTask(ds.item);
          break;
        case "rl-note":
          itemToNote(ds.item);
          break;
        case "sub-cat": {
          const widget = ds.w ? widgets[ds.w] : void 0;
          if (widget && ds.w) {
            void state.run("widget.update", { id: ds.w, settings: { ...widget.settings, cat: ds.v || null } });
          }
          break;
        }
        case "dk-next":
          stepDeck(ds.w, 1);
          break;
        case "dk-prev":
          stepDeck(ds.w, -1);
          break;
        case "dk-later": {
          const item = currentDeckItem(ds.w);
          if (item) toggleLater(item.id);
          stepDeck(ds.w, 1);
          break;
        }
        case "dk-task": {
          const item = currentDeckItem(ds.w);
          if (item) itemToTask(item.id);
          stepDeck(ds.w, 1);
          break;
        }
        case "dk-flip":
          if (ds.w) {
            const wId = ds.w;
            setDeck((current) => ({
              ...current,
              flipped: { ...current.flipped, [wId]: !current.flipped[wId] }
            }));
          }
          break;
        case "focus-toggle":
          void state.run("focus.set", { action: daily?.focus?.running ? "pause" : "start" });
          break;
        case "focus-reset":
          void state.run("focus.set", { action: "reset" });
          break;
        case "focus-next-task": {
          const open = (daily?.tasks ?? []).filter((task) => task.list === "today" && !task.done);
          const index = open.findIndex((task) => task.id === daily?.focus?.task);
          void state.run("focus.set", {
            action: "task",
            task: open[(index + 1) % Math.max(1, open.length)]?.id ?? null
          });
          break;
        }
        case "modal-close":
          setModal(null);
          setCaptureModalTab(null);
          setActiveEntryDetail(null);
          break;
        case "scrim":
          if (target === element) {
            setModal(null);
            setCaptureModalTab(null);
            setActiveEntryDetail(null);
          }
          break;
        case "proposal-approve":
          void decide(ds.proposal, "approve");
          break;
        case "proposal-reject":
          void decide(ds.proposal, "reject");
          break;
        case "proposal-rollback":
          void decide(ds.proposal, "rollback");
          break;
        default:
          break;
      }
    },
    [
      menu,
      state,
      widgets,
      daily,
      toggleLater,
      itemToTask,
      itemToNote,
      stepDeck,
      currentDeckItem,
      setSize,
      duplicateWidget,
      removeWidget,
      decide
    ]
  );
  const onRootSubmit = useCallback2(
    (event) => {
      const form = event.target instanceof Element ? event.target.closest("[data-form]") : null;
      if (!form) return;
      event.preventDefault();
      if (form.dataset.form === "hero-capture") {
        const value2 = heroInput.trim();
        if (!value2) return;
        const isUrl = /^https?:\/\/\S+$/i.test(value2);
        if (heroCaptureMode === "collection" || heroCaptureMode === "auto" && isUrl) {
          void state.run(
            "collection.save",
            isUrl ? { url: value2, title: value2 } : { title: value2 },
            { toast: "已存入偏好收藏库" }
          ).then(() => setHeroInput(""));
          return;
        }
        if (heroCaptureMode === "note") {
          void state.run("capture", { text: value2, mode: "note" }, { toast: "已记入速记备忘" }).then(() => setHeroInput(""));
          return;
        }
        if (heroCaptureMode === "task") {
          void state.run("capture", { text: value2, mode: "task" }, { toast: "已加入待排期收件箱" }).then(() => setHeroInput(""));
          return;
        }
        if (/^(todo|task)[:：\s]/i.test(value2)) {
          const clean = value2.replace(/^(todo|task)[:：\s]+/i, "").trim();
          void state.run("capture", { text: clean || value2, mode: "task" }, { toast: "已加入待排期收件箱" }).then(() => setHeroInput(""));
        } else {
          void state.run("capture", { text: value2, mode: "note" }, { toast: "已记入速记与灵感墙" }).then(() => setHeroInput(""));
        }
        return;
      }
      const input = form.querySelector("input");
      const value = (input?.value ?? "").trim();
      if (!value) return;
      if (form.dataset.form === "capture") {
        void state.run("capture", { text: value }).then(() => {
          if (input) input.value = "";
        });
      }
      if (form.dataset.form === "task-add") {
        void state.run("task.add", { title: value, list: "today" }).then(() => {
          if (input) input.value = "";
        });
      }
      if (form.dataset.form === "board-new") {
        void state.run("board.create", { name: value }).then(() => setMenu(null));
      }
    },
    [state, heroInput, heroCaptureMode]
  );
  useEffect4(() => {
    const onKeyDown = (event) => {
      const inField = /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName ?? "");
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        rootRef.current?.querySelector('input[name="cmd"]')?.focus();
        return;
      }
      if (event.key === "Escape") {
        if (menu) setMenu(null);
        else if (captureModalTab) setCaptureModalTab(null);
        else if (activeEntryDetail) setActiveEntryDetail(null);
        else if (modal) setModal(null);
        else if (cmdOpen) setCmdOpen(false);
        else if (editing) setEditing(false);
        return;
      }
      if (inField) return;
      const deckElement = document.activeElement?.closest?.("[data-deck]") ?? rootRef.current?.querySelector("[data-deck]:focus-within");
      if (!deckElement) return;
      const widgetId = deckElement.dataset.deck;
      if (!widgetId) return;
      if (event.key === "ArrowRight" || event.key === "ArrowDown") {
        event.preventDefault();
        stepDeck(widgetId, 1);
      }
      if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
        event.preventDefault();
        stepDeck(widgetId, -1);
      }
      if (event.key.toLowerCase() === "l") {
        const item = currentDeckItem(widgetId);
        if (item) toggleLater(item.id);
      }
      if (event.key === " " || event.key.toLowerCase() === "f") {
        event.preventDefault();
        setDeck((current) => ({
          ...current,
          flipped: { ...current.flipped, [widgetId]: !current.flipped[widgetId] }
        }));
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [menu, captureModalTab, activeEntryDetail, modal, cmdOpen, editing, stepDeck, currentDeckItem, toggleLater]);
  const onPointerDown = useCallback2(
    (event) => {
      const target = event.target instanceof Element ? event.target : null;
      if (!target || event.button !== 0) return;
      if (editing) {
        const card2 = target.closest(".sy-w");
        if (!card2 || target.closest(".sy-e-bar")) return;
        event.preventDefault();
        const widgetId2 = card2.dataset.id;
        if (!widgetId2) return;
        if (target.closest("[data-rz]")) {
          startResize(event, card2, widgetId2, cols, types, widgets, layout, (id, size) => setSize(id, size));
          return;
        }
        startDrag(event, card2, widgetId2, layout, activeBoard, (order) => {
          void state.run("layout.set", { boardId: activeBoard, cols, order });
        });
        return;
      }
      const card = target.closest('.sy-dk-card[data-pos="cur"]');
      if (!card || target.closest("button, a, .sy-ctl")) return;
      const deckElement = card.closest("[data-deck]");
      if (!deckElement) return;
      const vertical = deckElement.classList.contains("v");
      const widgetId = deckElement.dataset.deck;
      if (!widgetId) return;
      const startX = event.clientX;
      const startY = event.clientY;
      let delta = 0;
      let moved = false;
      const move = (moveEvent) => {
        delta = vertical ? moveEvent.clientY - startY : moveEvent.clientX - startX;
        if (!moved && Math.abs(delta) < 6) return;
        moved = true;
        deckElement.classList.add("dragging");
        card.style.transform = vertical ? `translateY(${delta * 0.6}px)` : `translateX(${delta}px) rotate(${delta / 22}deg)`;
      };
      const finish = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", finish);
        window.removeEventListener("pointercancel", finish);
        deckElement.classList.remove("dragging");
        card.style.transform = "";
        if (!moved) {
          if (card.classList.contains("paper")) {
            setDeck((current) => ({
              ...current,
              flipped: { ...current.flipped, [widgetId]: !current.flipped[widgetId] }
            }));
          } else if (vertical) stepDeck(widgetId, 1);
          return;
        }
        if (vertical) {
          if (delta < -30) stepDeck(widgetId, 1);
          else if (delta > 30) stepDeck(widgetId, -1);
          return;
        }
        if (delta > 90) {
          const item = currentDeckItem(widgetId);
          if (item) toggleLater(item.id);
          stepDeck(widgetId, 1);
        } else if (delta < -90) stepDeck(widgetId, 1);
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", finish);
      window.addEventListener("pointercancel", finish);
    },
    [editing, cols, types, widgets, layout, activeBoard, state, setSize, stepDeck, currentDeckItem, toggleLater]
  );
  const commands = useMemo5(() => {
    const text = query.trim();
    const out = [];
    const head = (text.match(/^(\S+)\s*(.*)$/)?.[1] ?? "").toLowerCase();
    const rest = text.match(/^(\S+)\s*(.*)$/)?.[2] ?? "";
    if (!text) {
      out.push({ group: "命令" });
      out.push({
        k: "todo",
        label: "新建任务",
        run: () => {
          setQuery("todo ");
        },
        keep: true
      });
      out.push({
        k: "note",
        label: "记一条 Note",
        run: () => {
          setQuery("note ");
        },
        keep: true
      });
      out.push({
        k: "save",
        label: "录入偏好收藏 (GitHub / X / 视频 / 网站)",
        run: () => {
          setCaptureModalTab("collection");
          setCmdOpen(false);
        }
      });
      out.push({
        k: "add",
        label: "添加 Widget",
        run: () => setModal({ kind: "gallery", type: "subscription", size: "M", sources: ["aihot"], pres: null })
      });
      out.push({ group: "视图导航" });
      out.push({
        k: "view",
        label: "首页 · 灵感与工作台",
        run: () => {
          setAppView("home");
          setCmdOpen(false);
        }
      });
      out.push({
        k: "view",
        label: "内容 · 收藏与速记库",
        run: () => {
          setAppView("content");
          setCmdOpen(false);
        }
      });
      out.push({
        k: "view",
        label: "排期 · 待办与日历",
        run: () => {
          setAppView("schedule");
          setCmdOpen(false);
        }
      });
      out.push({
        k: "view",
        label: "复盘 · 节奏与个人总结",
        run: () => {
          setAppView("retro");
          setCmdOpen(false);
        }
      });
      out.push({ group: "前往 Board" });
      for (const board2 of boards) {
        out.push({
          k: "go",
          label: board2.name,
          run: () => {
            setAppView("home");
            void state.run("board.active", { id: board2.id });
            setCmdOpen(false);
          }
        });
      }
      return out;
    }
    if (["todo", "t", "task"].includes(head)) {
      out.push({ group: "新建" });
      if (rest) {
        out.push({
          k: "↵",
          label: `新建任务「${rest}」→ 收件箱`,
          run: () => {
            void state.run("capture", { text: rest }, { toast: "已存进收件箱" });
            setQuery("");
            setCmdOpen(false);
          }
        });
      } else {
        out.push({ k: "…", label: "继续输入任务内容", keep: true, run: () => {
        } });
      }
      return out;
    }
    if (head === "note") {
      out.push({ group: "新建" });
      if (rest) {
        out.push({
          k: "↵",
          label: `存为 Note「${rest}」`,
          run: () => {
            void state.run("capture", { text: `#note ${rest}` }, { toast: "已存为 Note" });
            setQuery("");
            setCmdOpen(false);
          }
        });
      } else {
        out.push({ k: "…", label: "继续输入 Note 内容", keep: true, run: () => {
        } });
      }
      return out;
    }
    if (head === "add" || head === "widget") {
      out.push({ group: "Widget" });
      for (const [type, definition] of Object.entries(types)) {
        if (definition.soon) continue;
        if (rest && !definition.name.includes(rest)) continue;
        out.push({
          k: definition.soon ? "soon" : "P0",
          label: `添加「${definition.name}」`,
          run: () => setModal({ kind: "gallery", type, size: "M", sources: ["aihot"], pres: null })
        });
      }
      return out;
    }
    const lowered = text.toLowerCase();
    const matchedBoards = boards.filter((board2) => board2.name.includes(text));
    const matchedTasks = (daily?.tasks ?? []).filter((task) => task.title.toLowerCase().includes(lowered)).slice(0, 4);
    const matchedItems = state.items.filter((item) => String(item.title).toLowerCase().includes(lowered)).slice(0, 5);
    if (matchedBoards.length) {
      out.push({ group: "Board" });
      for (const board2 of matchedBoards) {
        out.push({
          k: "go",
          label: board2.name,
          run: () => {
            setAppView("home");
            void state.run("board.active", { id: board2.id });
            setCmdOpen(false);
          }
        });
      }
    }
    if (matchedTasks.length) {
      out.push({ group: "任务" });
      for (const task of matchedTasks) {
        out.push({
          k: task.done ? "✓" : "·",
          label: task.title,
          run: () => {
            void state.run("task.update", { id: task.id, done: !task.done });
            setCmdOpen(false);
          }
        });
      }
    }
    if (matchedItems.length) {
      out.push({ group: "订阅内容" });
      for (const item of matchedItems) {
        out.push({ k: item.sourceLabel ?? "", label: item.title, href: safeUrl(item.url) });
      }
    }
    out.push({ group: "新建" });
    out.push({
      k: "todo",
      label: `新建任务「${text}」`,
      run: () => {
        void state.run("capture", { text }, { toast: "已存进收件箱" });
        setQuery("");
        setCmdOpen(false);
      }
    });
    return out;
  }, [query, boards, daily?.tasks, state.items, types, state]);
  const screenshotTheme = theme === "dark" ? "dark" : "light";
  const board = boards.find((entry) => entry.id === activeBoard) ?? null;
  const openTasks = (daily?.tasks ?? []).filter((task) => task.list === "today" && !task.done).length;
  const freshItems = state.items.filter(
    (item) => item.itemKind !== "rank" && Date.now() - Date.parse(item.publishedAt ?? "") < 24 * 36e5
  ).length;
  const erroring = (daily?.sources ?? []).filter((source) => source.lastError).length;
  const readLaterCount = daily?.readLater?.length ?? 0;
  const renderHeadline = () => {
    if (!board) return /* @__PURE__ */ React24.createElement(React24.Fragment, null, greeting(), "。");
    if (board.id === "home") {
      return /* @__PURE__ */ React24.createElement(React24.Fragment, null, greeting(), "。今天还有 ", /* @__PURE__ */ React24.createElement(InlineHeadlineIcon, { name: "task", rotated: false, text: `${openTasks} 件事` }), "，", /* @__PURE__ */ React24.createElement(InlineHeadlineIcon, { name: "subscription", rotated: true, text: `${freshItems} 条` }), "新内容。");
    }
    if (board.id === "work") {
      return /* @__PURE__ */ React24.createElement(React24.Fragment, null, "工作。", /* @__PURE__ */ React24.createElement(InlineHeadlineIcon, { name: "task", rotated: false, text: `${openTasks} 件任务` }), "待办，", /* @__PURE__ */ React24.createElement(
        InlineHeadlineIcon,
        {
          name: "project",
          rotated: true,
          text: `${projectsOf(daily?.tasks ?? []).length} 个项目`
        }
      ), "在推进。");
    }
    if (board.id === "life") {
      return /* @__PURE__ */ React24.createElement(React24.Fragment, null, "生活。", /* @__PURE__ */ React24.createElement(InlineHeadlineIcon, { name: "habit", rotated: false, text: `${(daily?.habits ?? []).length} 个习惯` }), "在坚持，", /* @__PURE__ */ React24.createElement(InlineHeadlineIcon, { name: "bookmarks", rotated: true, text: `${(daily?.bookmarks ?? []).length} 个书签` }), "常去。");
    }
    if (board.id === "read") {
      return /* @__PURE__ */ React24.createElement(React24.Fragment, null, "阅读。", /* @__PURE__ */ React24.createElement(InlineHeadlineIcon, { name: "subscription", rotated: false, text: `${freshItems} 条` }), "新内容，", /* @__PURE__ */ React24.createElement(InlineHeadlineIcon, { name: "readlater", rotated: true, text: `${readLaterCount} 篇` }), "稍后读。");
    }
    return /* @__PURE__ */ React24.createElement(React24.Fragment, null, board.name, "。这个 Board 上有 ", /* @__PURE__ */ React24.createElement("b", null, layout.length, " 个 Widget"), "。");
  };
  return /* @__PURE__ */ React24.createElement(
    "div",
    {
      className: "sy-root",
      "data-theme": screenshotTheme,
      ref: rootRef,
      onClick: onRootClick,
      onSubmit: onRootSubmit,
      onPointerDown
    },
    /* @__PURE__ */ React24.createElement("style", null, tokens_default),
    /* @__PURE__ */ React24.createElement("div", { className: 'sy-grain', "aria-hidden": "true" }),
    /* @__PURE__ */ React24.createElement("div", { className: "sy-page" }, /* @__PURE__ */ React24.createElement("div", { className: `sy-frame${editing ? " sy-editing" : ""}`, "data-cols": cols }, /* @__PURE__ */ React24.createElement("header", { className: "sy-topbar" }, /* @__PURE__ */ React24.createElement("div", { className: "sy-brand" }, /* @__PURE__ */ React24.createElement(
      "svg",
      {
        viewBox: "0 0 320 320",
        width: 26,
        height: 26,
        "aria-hidden": true,
        dangerouslySetInnerHTML: { __html: BRAND_APP }
      }
    ), "sooyo", /* @__PURE__ */ React24.createElement("span", null, "daily")), /* @__PURE__ */ React24.createElement("nav", { className: "sy-seg sy-app-nav", role: "tablist", "aria-label": "主视图导航" }, /* @__PURE__ */ React24.createElement(
      "button",
      {
        type: "button",
        role: "tab",
        "aria-selected": appView === "home",
        "data-act": "app-view",
        "data-view": "home"
      },
      "首页"
    ), /* @__PURE__ */ React24.createElement(
      "button",
      {
        type: "button",
        role: "tab",
        "aria-selected": appView === "content",
        "data-act": "app-view",
        "data-view": "content"
      },
      "内容",
      unifiedEntries.length > 0 ? /* @__PURE__ */ React24.createElement("small", null, unifiedEntries.length) : null
    ), /* @__PURE__ */ React24.createElement(
      "button",
      {
        type: "button",
        role: "tab",
        "aria-selected": appView === "schedule",
        "data-act": "app-view",
        "data-view": "schedule"
      },
      "排期",
      openTasks > 0 ? /* @__PURE__ */ React24.createElement("small", null, openTasks) : null
    ), /* @__PURE__ */ React24.createElement(
      "button",
      {
        type: "button",
        role: "tab",
        "aria-selected": appView === "retro",
        "data-act": "app-view",
        "data-view": "retro"
      },
      "复盘"
    )), /* @__PURE__ */ React24.createElement("div", { className: "sy-cmd" }, /* @__PURE__ */ React24.createElement("div", { className: "sy-cmd-box" }, /* @__PURE__ */ React24.createElement(SvgIcon, { svg: I.search }), /* @__PURE__ */ React24.createElement(
      "input",
      {
        name: "cmd",
        value: query,
        placeholder: "搜索，或输入 todo · note · save · add",
        autoComplete: "off",
        "aria-label": "搜索或输入命令",
        onFocus: () => setCmdOpen(true),
        onChange: (event) => {
          setQuery(event.target.value);
          setCmdOpen(true);
        },
        onKeyDown: (event) => {
          if (event.key === "Enter") {
            const first = commands.find((entry) => typeof entry.run === "function");
            event.preventDefault();
            first?.run?.();
          }
        }
      }
    ), /* @__PURE__ */ React24.createElement("kbd", null, "⌘K")), cmdOpen && commands.length > 0 ? /* @__PURE__ */ React24.createElement("div", { className: "sy-cmd-pop", role: "listbox" }, commands.map(
      (entry, index) => entry.group ? /* @__PURE__ */ React24.createElement("div", { key: `g${index}`, className: "sy-cmd-group" }, entry.group) : entry.href ? /* @__PURE__ */ React24.createElement(
        "a",
        {
          key: `i${index}`,
          className: "sy-cmd-item",
          role: "option",
          href: entry.href,
          target: "_blank",
          rel: "noopener noreferrer",
          onClick: () => {
            if (!entry.keep) setCmdOpen(false);
            entry.run?.();
          }
        },
        /* @__PURE__ */ React24.createElement("span", { className: "k" }, entry.k ?? ""),
        /* @__PURE__ */ React24.createElement("span", { className: "ci-t c1" }, entry.label)
      ) : /* @__PURE__ */ React24.createElement(
        "button",
        {
          key: `i${index}`,
          className: "sy-cmd-item",
          role: "option",
          onClick: () => {
            if (!entry.keep) setCmdOpen(false);
            entry.run?.();
          }
        },
        /* @__PURE__ */ React24.createElement("span", { className: "k" }, entry.k ?? ""),
        /* @__PURE__ */ React24.createElement("span", { className: "ci-t c1" }, entry.label)
      )
    )) : null), /* @__PURE__ */ React24.createElement("div", { className: "sy-actions" }, /* @__PURE__ */ React24.createElement(
      "button",
      {
        type: "button",
        className: "sy-btn sy-btn-capture",
        "data-act": "capture-modal-open",
        "data-tab": "collection"
      },
      /* @__PURE__ */ React24.createElement(SvgIcon, { svg: I.plus }),
      /* @__PURE__ */ React24.createElement("span", { className: "lbl" }, "录入收藏")
    ), appView === "home" ? /* @__PURE__ */ React24.createElement(React24.Fragment, null, /* @__PURE__ */ React24.createElement(
      "button",
      {
        className: "sy-switch",
        role: "switch",
        "aria-checked": editing,
        "data-act": "edit-toggle"
      },
      /* @__PURE__ */ React24.createElement("span", { className: "lbl" }, "编辑"),
      /* @__PURE__ */ React24.createElement("span", { className: "sy-sw", "aria-hidden": true })
    ), /* @__PURE__ */ React24.createElement("button", { className: "sy-btn sy-btn-add", "data-act": "gallery-open" }, /* @__PURE__ */ React24.createElement(SvgIcon, { svg: I.plus }), /* @__PURE__ */ React24.createElement("span", { className: "lbl" }, "添加 Widget"))) : null, /* @__PURE__ */ React24.createElement(
      "button",
      {
        className: "sy-icon-btn",
        "aria-label": "切换浅色或深色",
        onClick: () => {
          const next = screenshotTheme === "dark" ? "light" : "dark";
          setTheme(next);
          try {
            window.localStorage.setItem("sooyo:theme", next);
          } catch {
          }
        }
      },
      /* @__PURE__ */ React24.createElement(SvgIcon, { svg: screenshotTheme === "dark" ? I.sun : I.moon })
    ), /* @__PURE__ */ React24.createElement(
      "button",
      {
        className: "sy-icon-btn",
        "aria-label": "刷新信息源",
        title: "刷新信息源",
        onClick: () => void state.refreshSources()
      },
      /* @__PURE__ */ React24.createElement(SvgIcon, { svg: I.reset })
    ))), appView === "home" ? /* @__PURE__ */ React24.createElement(React24.Fragment, null, /* @__PURE__ */ React24.createElement("section", { className: "sy-hero" }, /* @__PURE__ */ React24.createElement("div", { className: "sy-hero-main" }, /* @__PURE__ */ React24.createElement("div", { className: "sy-hero-top-row" }, /* @__PURE__ */ React24.createElement("span", { className: "sy-tag" }, `${(/* @__PURE__ */ new Date()).getMonth() + 1}月${(/* @__PURE__ */ new Date()).getDate()}日 · 星期${WEEK[(/* @__PURE__ */ new Date()).getDay()]}`), /* @__PURE__ */ React24.createElement("div", { className: "sy-status" }, /* @__PURE__ */ React24.createElement("i", { className: erroring > 0 ? "warn" : "" }), `${(daily?.sources ?? []).length - erroring} 个来源正常 · ${state.items.length} 条内容`)), /* @__PURE__ */ React24.createElement("h1", { className: "sy-headline" }, renderHeadline()), /* @__PURE__ */ React24.createElement("form", { className: "sy-hero-capture", "data-form": "hero-capture" }, /* @__PURE__ */ React24.createElement("div", { className: "sy-hero-capture-modes" }, [
      { id: "auto", label: "智能识别" },
      { id: "note", label: "✎ 速记/闪念" },
      { id: "collection", label: "★ 偏好收藏" },
      { id: "task", label: "✓ 待办事项" }
    ].map((m) => /* @__PURE__ */ React24.createElement(
      "button",
      {
        key: m.id,
        type: "button",
        className: "sy-hero-mode-pill",
        "aria-pressed": heroCaptureMode === m.id,
        onClick: () => setHeroCaptureMode(m.id)
      },
      m.label
    ))), /* @__PURE__ */ React24.createElement("div", { className: "sy-hero-capture-row" }, /* @__PURE__ */ React24.createElement(
      "input",
      {
        name: "hero-q",
        value: heroInput,
        onChange: (event) => setHeroInput(event.target.value),
        placeholder: heroCaptureMode === "collection" ? "粘贴 GitHub / X / 网站 / 视频 / 音乐链接，回车保存元信息…" : heroCaptureMode === "task" ? "输入待办事项，回车进入排期收件箱…" : "随手记一条灵感备忘、贴入收藏链接，或输入 todo: 记待办…",
        autoComplete: "off"
      }
    ), /* @__PURE__ */ React24.createElement("button", { type: "submit", className: "sy-btn sy-btn-ink" }, "记下来 ↵"), /* @__PURE__ */ React24.createElement(
      "button",
      {
        type: "button",
        className: "sy-btn",
        "data-act": "capture-modal-open",
        "data-tab": "collection",
        title: "打开完整录入面板（支持缩略图、飞书外链、JSON/CSV 批量导入）"
      },
      "详细录入"
    )), relatedHeroEntries.length > 0 ? /* @__PURE__ */ React24.createElement("div", { className: "sy-hero-related" }, /* @__PURE__ */ React24.createElement("span", { className: "meta" }, "相似已收录："), relatedHeroEntries.map((item) => /* @__PURE__ */ React24.createElement(
      "button",
      {
        key: item.id,
        type: "button",
        className: "sy-hero-related-chip",
        onClick: () => setActiveEntryDetail(item)
      },
      /* @__PURE__ */ React24.createElement("span", null, KIND_BADGE_LABELS[item.kind] ?? item.kind),
      /* @__PURE__ */ React24.createElement("span", { className: "c1" }, item.title)
    ))) : null)), /* @__PURE__ */ React24.createElement("div", { className: "sy-hero-aside" }, /* @__PURE__ */ React24.createElement(
      MiniStamps,
      {
        dayMap,
        onCaptureToday: () => setCaptureModalTab("note"),
        onOpenSchedule: (date) => {
          if (date) setScheduleFocusDay(date);
          setAppView("schedule");
        }
      }
    ))), /* @__PURE__ */ React24.createElement("div", { className: "sy-home-dock", role: "toolbar", "aria-label": "看板与灵感墙切换" }, /* @__PURE__ */ React24.createElement("div", { className: "sy-home-dock-left" }, /* @__PURE__ */ React24.createElement(BoardTabs, { boards, activeBoard }), /* @__PURE__ */ React24.createElement("div", { className: "sy-seg sm" }, /* @__PURE__ */ React24.createElement(
      "button",
      {
        type: "button",
        "aria-selected": homeMode === "bento",
        onClick: () => setHomeMode("bento")
      },
      "工作台看板"
    ), /* @__PURE__ */ React24.createElement(
      "button",
      {
        type: "button",
        "aria-selected": homeMode === "wall",
        onClick: () => setHomeMode("wall")
      },
      `灵感与收藏墙 (${filteredHomeEntries.length})`
    ))), /* @__PURE__ */ React24.createElement("div", { className: "sy-home-dock-filters" }, KIND_FILTER_OPTIONS.map((f) => /* @__PURE__ */ React24.createElement(
      "button",
      {
        key: f.value,
        type: "button",
        className: "sy-chipbtn",
        "aria-pressed": homeKindFilter === f.value,
        onClick: () => {
          setHomeKindFilter(f.value);
          if (f.value !== "all") setHomeMode("wall");
        }
      },
      f.label
    )))), homeMode === "wall" ? /* @__PURE__ */ React24.createElement("section", { className: "sy-home-wall-section" }, filteredHomeEntries.length === 0 ? /* @__PURE__ */ React24.createElement("div", { className: "sy-view-empty" }, /* @__PURE__ */ React24.createElement("p", null, "当前分类还没有速记或偏好收藏。"), /* @__PURE__ */ React24.createElement(
      "button",
      {
        type: "button",
        className: "sy-btn sy-btn-ink",
        "data-act": "capture-modal-open",
        "data-tab": "collection"
      },
      "+ 录入第一条收藏或闪念"
    )) : /* @__PURE__ */ React24.createElement("div", { className: "sy-wall-grid" }, filteredHomeEntries.map((entry) => /* @__PURE__ */ React24.createElement(
      MediaCollectionCard,
      {
        key: entry.id,
        entry,
        onOpen: setActiveEntryDetail,
        onQuickTask: (item) => void state.run(
          "item.toTask",
          {
            title: item.title.slice(0, 60),
            origin: { source: KIND_BADGE_LABELS[item.kind] ?? "收藏", url: item.url }
          },
          { toast: "已转为待办任务" }
        )
      }
    )))) : null, editing ? /* @__PURE__ */ React24.createElement("div", { className: "sy-editbar" }, /* @__PURE__ */ React24.createElement("span", { className: "grow" }, `正在编辑「${board?.name ?? ""}」的布局（${cols} 列）。拖动卡片排序，拖右下角改尺寸；不同宽度各自保存。`), /* @__PURE__ */ React24.createElement("button", { className: "sy-btn", "data-act": "gallery-open" }, "添加"), /* @__PURE__ */ React24.createElement("button", { className: "sy-btn sy-btn-ink", "data-act": "edit-toggle" }, "完成")) : null, /* @__PURE__ */ React24.createElement(
      WidgetGrid,
      {
        gridRef,
        cols,
        layout,
        widgets,
        positions,
        context
      }
    ), /* @__PURE__ */ React24.createElement("div", { className: "meta", style: { marginTop: 14, whiteSpace: "normal", lineHeight: "19px" } }, "数据来源：AIHOT（个人非商业使用）、HuggingFace、Product Hunt、YouTube。抓取到的内容一律视为资料，不作为指令执行。")) : null, appView === "content" ? /* @__PURE__ */ React24.createElement(
      ContentView,
      {
        notes: daily?.notes ?? [],
        readLaterEntries: daily?.readLaterEntries ?? {},
        bookmarks: daily?.bookmarks ?? [],
        feedItems: state.items,
        onRun: state.run,
        onOpenCapture: (tab) => setCaptureModalTab(tab),
        onOpenEntry: (entry) => setActiveEntryDetail(entry)
      }
    ) : null, appView === "schedule" ? /* @__PURE__ */ React24.createElement(
      ScheduleView,
      {
        tasks: daily?.tasks ?? [],
        dayMap,
        initialFocusDay: scheduleFocusDay,
        onCaptureToday: () => setCaptureModalTab("task"),
        onRun: state.run
      }
    ) : null, appView === "retro" ? /* @__PURE__ */ React24.createElement(
      RetroView,
      {
        daily,
        items: state.items,
        onRun: state.run,
        onNavigate: (v) => setAppView(v),
        onOpenEntry: (entry) => setActiveEntryDetail(entry)
      }
    ) : null)),
    menu ? /* @__PURE__ */ React24.createElement(
      MenuLayer,
      {
        menu,
        widgets,
        types,
        context,
        onClose: () => setMenu(null)
      }
    ) : null,
    modal ? /* @__PURE__ */ React24.createElement(
      ModalLayer,
      {
        modal,
        widgets,
        types,
        context,
        board,
        onClose: () => setModal(null),
        onAdd: addWidget,
        onRun: state.run
      }
    ) : null,
    captureModalTab ? /* @__PURE__ */ React24.createElement(
      CaptureModal,
      {
        initialTab: captureModalTab,
        onClose: () => setCaptureModalTab(null),
        onRun: state.run
      }
    ) : null,
    activeEntryDetail ? /* @__PURE__ */ React24.createElement(
      EntryDetailModal,
      {
        entry: activeEntryDetail,
        onClose: () => setActiveEntryDetail(null),
        onRun: state.run
      }
    ) : null,
    state.toast ? /* @__PURE__ */ React24.createElement("div", { className: "sy-toast", role: "status" }, /* @__PURE__ */ React24.createElement("span", null, state.toast.text)) : null
  );
}

// src/client/index.ts
var PANEL_ID = "sooyo";
function SooyoIcon(props) {
  const size = props?.size ?? 18;
  return React25.createElement("svg", {
    viewBox: "0 0 24 24",
    width: size,
    height: size,
    "aria-hidden": true,
    style: { display: "block", opacity: props?.active ? 1 : 0.72 },
    dangerouslySetInnerHTML: { __html: BRAND_SMALL }
  });
}
var clientPlugin = {
  inject: ["slots"],
  apply(ctx) {
    ctx.slots.inject(
      "sidebar.panellist",
      () => ctx.slots.register(
        { name: "sidebar.panellist", id: PANEL_ID, order: 40, label: "sooyo daily" },
        SooyoIcon
      )
    );
    ctx.slots.inject("main", () => ctx.slots.register({ name: "main", key: PANEL_ID }, SooyoPanel));
  }
};
var index_default = clientPlugin;

    return module.exports.default ?? module.exports.clientPlugin ?? module.exports
  },
})
