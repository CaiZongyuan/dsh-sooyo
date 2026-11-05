// Reproduce the mobile layout from the real CSS, then measure it.
//
// The sooyo panel is not a standalone page: it renders inside the DSH shell, behind a token, and
// the mobile screenshot came from a phone browser. Rather than drive the whole app, this harness
// takes the panel's actual CSS and DOM shape and lays it out at a phone width, so the geometry
// being debugged is the real geometry.
import { readFileSync, writeFileSync } from 'node:fs'

const client = readFileSync(new URL('../client.js', import.meta.url), 'utf8')

// Pull the CSS template literal out of client.js exactly as the browser receives it.
const start = client.indexOf('const CSS = `')
if (start < 0) throw new Error('CSS literal not found')
const body = client.slice(start + 'const CSS = `'.length)
const end = body.search(/^`$/m)
if (end < 0) throw new Error('CSS literal not terminated')
const css = body.slice(0, end)

// The same class names and nesting the panel renders. Only the shell that matters for the two
// reported problems is included: the top bar (board segments + command) and the hero headline.
const html = `<!doctype html>
<html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  html, body { margin: 0; padding: 0; background: #F3F4F6; }
  /* Approximate the DSH shell: the panel is a grid child that must be allowed to shrink. */
  #shell { display: grid; grid-template-columns: 1fr; height: 100vh; }
  #shell > .sy-root { min-width: 0; }
${css}
</style></head>
<body>
<div id="shell">
<div class="sy-root" data-theme="light">
  <div class="sy-grain" aria-hidden="true"></div>
  <div class="sy-page">
    <div class="sy-frame" data-cols="4">
      <header class="sy-topbar">
        <div class="sy-brand"><i></i>sooyo<span>daily</span></div>
        <div class="sy-seg sy-seg-boards" role="tablist">
          <button role="tab" aria-pressed="true">总览</button>
          <button role="tab" aria-pressed="false">工作</button>
          <button role="tab" aria-pressed="false">生活</button>
          <button role="tab" aria-pressed="false">阅读</button>
          <button class="sy-seg-add" aria-label="新建 Board">+</button>
        </div>
        <div class="sy-cmd">
          <div class="sy-cmd-box"><span>search</span><input placeholder="搜索，或输入 todo · note · add"><kbd>⌘K</kbd></div>
        </div>
        <div class="sy-actions">
          <button class="sy-switch"><span class="lbl">编辑</span><span class="sy-sw"></span></button>
          <button class="sy-btn sy-btn-add"><span>+</span><span class="lbl">添加 Widget</span></button>
          <button class="sy-icon-btn">icon</button>
        </div>
      </header>
      <section class="sy-hero">
        <div>
          <span class="sy-tag">11月5日 · 星期三</span>
          <h1 class="sy-headline">生活。<span class="sy-nw"><img class="sy-hi" src="x.webp" onerror="this.remove()"><b>3 个习惯</b></span>在坚持，<span class="sy-nw"><img class="sy-hi r" src="x.webp" onerror="this.remove()"><b>6 个书签</b></span>常去。</h1>
        </div>
        <div class="sy-status"><i></i>5 个来源正常 · 117 条内容</div>
      </section>
    </div>
  </div>
</div>
</div>
</body></html>`

const out = new URL('../dev/mobile-harness.html', import.meta.url)
writeFileSync(out, html)
console.log('wrote', out.pathname)
console.log('css chars:', css.length)
