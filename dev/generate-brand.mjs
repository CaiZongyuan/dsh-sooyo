/** Canonical Sooyo vector artwork. Run with node dev/generate-brand.mjs. */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'

const root = new URL('../', import.meta.url)
const palette = {
  navy: '#282D55', cobalt: '#344DA8', terracotta: '#DF793D',
  clay: '#E9B68C', stone: '#F1D5BC', paper: '#FFF6EC',
}
const { navy, cobalt, terracotta, clay, stone, paper } = palette
const outline = 'M19 116C55 110 112 118 147 142C151 100 171 70 203 69C219 68 233 73 245 81C263 77 280 78 284 85C271 89 260 98 256 109L253 137C286 120 322 114 347 116Q361 116 357 132C345 191 306 221 244 219L215 217L221 250Q224 266 208 265Q199 274 189 266Q175 274 168 264Q152 269 147 260Q143 255 150 245L165 217C80 231 30 204 16 135Q10 119 19 116Z'
const eye = 'M171 110C187 81 216 78 238 99C224 128 195 136 171 110Z'
const pupil = 'M190 106C190 91 215 86 220 101C224 116 197 123 191 111Z'
const belly = 'M150 217C163 192 179 175 200 176C222 177 232 195 224 212C207 234 175 231 150 217Z'
const note = 'M263 142L317 137Q333 136 326 153L313 181Q309 192 298 193L253 196Q239 197 244 182L252 153Q255 144 263 142Z'
const tiles = [
  'M58 134H75Q84 134 84 143V155Q84 163 76 163H58Q50 163 50 155V143Q50 134 58 134Z',
  'M98 134H114Q123 134 123 143V155Q123 163 115 163H98Q90 163 90 155V143Q90 134 98 134Z',
  'M62 169H78Q87 169 87 178V190Q87 199 79 199H63Q54 199 54 190V178Q54 169 62 169Z',
  'M102 169H118Q127 169 127 178V190Q127 199 119 199H103Q94 199 94 190V178Q94 169 102 169Z',
]
const lines = ['M270 156H310', 'M264 176H299']
const rays = (color) => `<path d="M205 23V44M162 42L173 56M249 38L237 54" fill="none" stroke="${color}" stroke-width="13" stroke-linecap="round"/>`
const path = (d, fill, extra = '') => `<path d="${d}" fill="${fill}"${extra}/>`
function bird(inverse = false) {
  const ink = inverse ? stone : cobalt
  return rays(terracotta) + path(outline, ink)
    + path('M147 142C151 100 171 70 203 69C219 68 233 73 245 81C263 77 280 78 284 85C271 89 260 98 256 109C256 158 238 179 208 181C178 183 154 168 147 142Z', inverse ? cobalt : navy, ` opacity="${inverse ? '.7' : '.22'}"`)
    + path(eye, inverse ? paper : stone) + path(pupil, navy)
    + tiles.map((d, i) => path(d, inverse ? (i === 0 ? cobalt : clay) : clay)).join('')
    + path(note, inverse ? paper : clay)
    + `<path d="${lines.join('')}" fill="none" stroke="${inverse ? cobalt : navy}" stroke-width="8" stroke-linecap="round"/>`
    + path(belly, inverse ? stone : clay)
}
// True transparent counters: the monochrome mark works on any background.
const lineCounters = 'M272 151H308A4 4 0 0 1 308 159H272A4 4 0 0 1 272 151ZM266 171H297A4 4 0 0 1 297 179H266A4 4 0 0 1 266 171Z'
const mono = rays('currentColor') + path(outline + eye + tiles.join('') + lineCounters, 'currentColor', ' fill-rule="evenodd"') + path(pupil, 'currentColor')
// Optical size: one eye counter, four larger tiles, and one list stroke.
const compact = `<path fill="currentColor" fill-rule="evenodd" d="M2 8.5C5 8 8 9 10 10.6C10.3 7.2 12 5 14.4 5C15.5 5 16.4 5.4 17 5.8C18.2 5.5 19.2 5.6 19.6 6.1L17.8 7.3L17.5 10.1C19.2 9.2 21.2 8.7 23 8.8C22.3 13.8 19.6 16.2 15 16L15.5 18.8Q15.8 20 14.5 19.8Q13.7 20.5 13 19.8Q11.5 20.5 10.8 19.5L12.1 16.4C6 17.5 2.2 14.7 1.3 9.5Q1.1 8.6 2 8.5ZM11.7 8.3Q13.5 5.5 16.3 7.6Q14.5 10.4 11.7 8.3ZM4 10H6V12H4ZM7 10H9V12H7ZM4.6 13H6.6V15H4.6ZM7.6 13H9.6V15H7.6ZM18 11H21V12.5H18Z"/><circle cx="14" cy="7.9" r=".85" fill="currentColor"/><path d="M14 1.4V3M10.6 2.5L11.5 3.6M17.3 2.4L16.4 3.6" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>`
// Custom path lettering; no fonts or external resources are needed.
const wordmark = `<g fill="none" stroke="currentColor" stroke-width="20" stroke-linecap="round" stroke-linejoin="round"><path d="M49 19C36 12 13 15 12 29C10 42 49 40 50 55C52 72 24 79 9 68"/><ellipse cx="104" cy="45" rx="28" ry="29"/><ellipse cx="181" cy="45" rx="28" ry="29"/><path d="M229 17L256 73M289 17L245 109"/><ellipse cx="337" cy="45" rx="28" ry="29"/></g>`
const app = `<rect width="320" height="320" rx="76" fill="${navy}"/><g transform="translate(15 36) scale(.8)">${bird(true)}</g>`
const svg = (viewBox, body, color = navy, label = 'sooyo') => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" color="${color}" role="img" aria-label="${label}">${body}</svg>\n`
const assets = {
  'symbol.svg': svg('0 0 372 284', bird()),
  'symbol-mono.svg': svg('0 0 372 284', mono),
  'symbol-small.svg': svg('0 0 24 24', compact),
  'wordmark.svg': svg('0 0 384 124', `<g transform="translate(4 0)">${wordmark}</g>`),
  'logo.svg': svg('0 0 800 284', bird() + `<g transform="translate(402 112)">${wordmark}</g>`),
  'logo-reversed.svg': svg('0 0 800 284', `<g color="${paper}">${mono}<g transform="translate(402 112)">${wordmark}</g></g>`, paper),
  'app-icon.svg': svg('0 0 320 320', app),
}
mkdirSync(new URL('assets/brand/', root), { recursive: true })
for (const [name, source] of Object.entries(assets)) writeFileSync(new URL(`assets/brand/${name}`, root), source, 'utf8')
writeFileSync(new URL('icon.svg', root), assets['app-icon.svg'], 'utf8')

// The DSH Client is a standalone loader script. Embed trusted artwork so no
// new runtime import, asset endpoint or HTTP request is required.
const clientPath = new URL('client.js', root)
const client = readFileSync(clientPath, 'utf8')
const start = '    // BEGIN GENERATED BRAND ART — node dev/generate-brand.mjs'
const end = '    // END GENERATED BRAND ART'
if (!client.includes(start) || !client.includes(end)) throw new Error('Client brand markers are missing')
writeFileSync(clientPath, client.slice(0, client.indexOf(start)) + `${start}\n    const BRAND_APP = ${JSON.stringify(app)}\n    const BRAND_SMALL = ${JSON.stringify(compact)}\n${end}` + client.slice(client.indexOf(end) + end.length), 'utf8')

const swatches = Object.entries(palette).map(([name, hex]) => `<div><i style="background:${hex}"></i><b>${name}</b><code>${hex}</code></div>`).join('')
const sizeRow = (dark = false) => `<div class="sizes${dark ? ' dark' : ''}">${[16, 18, 24, 32, 48].map(size => `<div><svg viewBox="0 0 24 24" width="${size}" height="${size}" aria-label="${size} pixels">${compact}</svg><small>${size}px</small></div>`).join('')}</div>`
writeFileSync(new URL('assets/brand/preview.html', root), `<!doctype html>
<html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>sooyo · 品牌素材</title>
<style>
*{box-sizing:border-box}body{margin:0;background:${paper};color:${navy};font-family:system-ui,-apple-system,"Segoe UI",sans-serif}main{max-width:1180px;margin:auto;padding:56px 40px}header{display:flex;justify-content:space-between;gap:16px;align-items:center;border-bottom:1px solid ${stone};padding-bottom:20px}header b{letter-spacing:.18em;font-size:13px}header span{font-size:12px;color:#756454}h1{font-size:36px;letter-spacing:-.04em;margin:38px 0 12px}p{line-height:1.8;color:#756454}h2{font-size:12px;letter-spacing:.15em;text-transform:uppercase;margin:0 0 26px}a{color:inherit;text-underline-offset:4px}.hero{padding:38px 0 48px;display:flex;justify-content:center}.hero img{width:85%;max-width:800px}.grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:20px}.tile{padding:28px;border:1px solid ${stone};border-radius:24px;display:flex;flex-direction:column;justify-content:space-between;gap:22px}.tile img{height:150px;max-width:100%;align-self:center}.tile small{font-size:12px}.dark{background:${navy};color:${paper};border-color:${navy}}.dark img{width:100%}.section{margin-top:44px}.palette{display:grid;grid-template-columns:repeat(6,1fr);gap:16px}.palette i{display:block;height:65px;border-radius:14px;border:1px solid #282d5515;margin-bottom:12px}.palette b,.palette code{display:block;font-size:12px;margin:6px 0}.palette b{text-transform:capitalize}.palette code{color:#756454}.sizes{display:flex;align-items:center;justify-content:space-around;padding:26px;border-radius:18px;min-height:120px}.sizes div{display:flex;flex-direction:column;align-items:center;gap:14px}.sizes small{font-size:11px;opacity:.65}.size-grid{display:grid;grid-template-columns:1fr 1fr;gap:20px}footer{border-top:1px solid ${stone};padding-top:22px;margin-top:40px;font-size:12px;color:#756454}@media(max-width:650px){main{padding:28px 20px}h1{font-size:28px}.grid{grid-template-columns:1fr}.hero img{width:100%}.palette{grid-template-columns:repeat(3,1fr)}.size-grid{grid-template-columns:1fr}header{align-items:flex-start;flex-direction:column}}
</style><main><header><b>SOOYO / BRAND ASSETS</b><span>01 · 灵感源于良渚玉鸟</span></header>
<h1>让信息有序，让日常从容。</h1><p>温和、聪明、有条理的个人空间。双翼收拢工具与信息，陪你把想法变成行动。</p>
<div class="hero"><img src="logo.svg" alt="sooyo 彩色主标"></div>
<div class="grid"><article class="tile"><h2>App icon / 应用图标</h2><img src="app-icon.svg" alt="应用图标"><small><a href="app-icon.svg" download>下载 SVG</a> · <a href="app-icon-512.png" download>PNG 512</a></small></article><article class="tile"><h2>Symbol / 独立图形</h2><img src="symbol.svg" alt="彩色鸟形标"><small><a href="symbol.svg" download>下载 SVG</a> · <a href="symbol-mono.svg" download>单色版</a></small></article><article class="tile dark"><h2>Reverse / 反白组合</h2><img src="logo-reversed.svg" alt="反白主标"><small><a href="logo-reversed.svg" download>下载 SVG</a></small></article></div>
<section class="section"><h2>Palette / 品牌色</h2><div class="palette">${swatches}</div></section>
<section class="section"><h2>Optical sizes / 小尺寸图标</h2><div class="size-grid">${sizeRow()}${sizeRow(true)}</div></section>
<footer><a href="../../docs/brand.md">品牌使用规范</a> · <a href="logo.svg" download>主标 SVG</a> · <a href="wordmark.svg" download>独立字标</a><p>依据品牌展示图重新绘制的平面矢量版；字标为固定路径，无外部字体依赖。</p></footer></main></html>`, 'utf8')
console.log('Generated Sooyo SVG assets, preview, plugin icon and embedded Client marks.')
