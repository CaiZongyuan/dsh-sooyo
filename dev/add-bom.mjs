// Add a UTF-8 BOM to the E2E PowerShell scripts.
//
// PowerShell 5.1 decodes a .ps1 as the ANSI codepage unless the file starts with a UTF-8 BOM.
// These scripts contain Chinese literals, so without the BOM `'E2E 同步验证任务'` is decoded as
// mojibake, its closing quote is lost, and the parser fails with a misleading "hash literal was
// incomplete" several lines later. A BOM is correct for a script; it is JSON files that reject it.
import { readFileSync, writeFileSync } from 'node:fs'

const BOM = '\uFEFF'

for (const file of ['../dev/e2e-setup.ps1', '../dev/e2e-verify.ps1', '../dev/e2e-teardown.ps1']) {
  let url
  try {
    url = new URL(file, import.meta.url)
    readFileSync(url)
  } catch {
    console.log(`skip (absent) ${file}`)
    continue
  }
  let text = readFileSync(url, 'utf8')
  if (text.startsWith(BOM)) {
    console.log(`already has a BOM  ${file}`)
    continue
  }
  // Normalise any pre-existing replacement characters first, so a mojibake run cannot hide.
  const bad = (text.match(/\uFFFD/g) ?? []).length
  writeFileSync(url, BOM + text, 'utf8')
  console.log(`added BOM  ${file}  (${text.length} chars, ${bad} replacement chars)`)
}
