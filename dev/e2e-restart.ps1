# Prove AC-04's durability half: restart the Hub and check every record survived.
#
# `dev/e2e-verify.ps1` writes $env:TEMP\sooyo-e2e-before-restart.json at the end of its run.
# This script stops the Hub, starts it again, and compares. It then re-checks that both Clients
# reconnect on their own — a Client that cached forever would pass a stale snapshot here.
#
# Usage: powershell -NoProfile -ExecutionPolicy Bypass -File dev/e2e-restart.ps1
#
# NB: the file needs a UTF-8 BOM for PowerShell 5.1 to read the Chinese literals; `dev/add-bom.mjs`
# adds it. Keep this file ASCII-only otherwise.

param(
  [string]$Profile = 'sooyo-hub',
  [int]$Port = 3101
)

$ErrorActionPreference = 'Stop'
$HUB = "http://127.0.0.1:$Port"
$stateFile = Join-Path $env:TEMP 'sooyo-e2e-before-restart.json'
$instanceHome = Join-Path (Join-Path $env:DSH_HOME 'e2e') 'hub'

$results = New-Object System.Collections.ArrayList
function Check([string]$name, [bool]$ok, [string]$detail = '') {
  [void]$results.Add([pscustomobject]@{ Name = $name; Ok = $ok; Detail = $detail })
  $mark = if ($ok) { 'PASS' } else { 'FAIL' }
  $suffix = if ($detail) { "  -> $detail" } else { '' }
  Write-Host ("{0}  {1}{2}" -f $mark, $name, $suffix)
}

if (-not (Test-Path $stateFile)) {
  Write-Host "missing $stateFile — run dev/e2e-verify.ps1 first (it writes the state to compare)."
  exit 1
}
$before = Get-Content $stateFile -Raw -Encoding UTF8 | ConvertFrom-Json
Write-Host ("before: revision={0}, {1} task(s)" -f $before.revision, $before.tasks.Count)

Write-Host ''
Write-Host '-- stopping the Hub --'
Get-Process -Name node -ErrorAction SilentlyContinue | ForEach-Object {
  $command = (Get-CimInstance Win32_Process -Filter "ProcessId=$($_.Id)").CommandLine
  if ($command -like "*--profile $Profile*") {
    Write-Host "  stopping pid $($_.Id)"
    Stop-Process -Id $_.Id -Force
  }
}
Start-Sleep -Seconds 4
try {
  Invoke-WebRequest "$HUB/sooyo/ping" -UseBasicParsing -TimeoutSec 3 | Out-Null
  Check 'the Hub is really stopped before restarting' $false 'it still answers'
} catch {
  Check 'the Hub is really stopped before restarting' $true 'connection refused'
}

Write-Host ''
Write-Host '-- starting the Hub again --'
$env:DSH_HOME = $instanceHome
$log = Join-Path $env:TEMP 'sooyo-e2e-hub-restart.log'
# Two Windows traps here:
#  - `dsh` is a .ps1/.cmd shim, so `Start-Process -FilePath 'dsh'` fails with "not a valid Win32
#    application"; it has to be launched through powershell.exe.
#  - `Start-Process -RedirectStandardOutput` keeps the parent attached to the child's pipes, so
#    the script blocks until the server exits (it never does). Redirecting *inside* the child
#    (`*>` in its own command line) leaves this process free to poll for readiness.
$command = "`$env:DSH_HOME='$instanceHome'; dsh --profile $Profile --port $Port --no-open *> '$log'"
$process = Start-Process -FilePath 'powershell.exe' -ArgumentList @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', $command) -PassThru
Write-Host "  pid $($process.Id), log $log"

$ready = $false
for ($attempt = 0; $attempt -lt 40; $attempt++) {
  Start-Sleep -Seconds 2
  try {
    $ping = (Invoke-WebRequest "$HUB/sooyo/ping" -UseBasicParsing -TimeoutSec 5).Content | ConvertFrom-Json
    if ($ping.ready) { $ready = $true; break }
  } catch { }
}
Check 'the restarted Hub becomes ready' $ready "after $($attempt * 2)s"
if (-not $ready) {
  Write-Host ''
  Write-Host ("{0}/{1} checks passed" -f ($results.Count - 1), $results.Count)
  exit 1
}

Write-Host ''
$after = (Invoke-WebRequest "$HUB/sooyo/daily" -UseBasicParsing -TimeoutSec 20).Content | ConvertFrom-Json
Check 'the revision is unchanged by a restart (no phantom write)' ($after.dataRevision -eq $before.revision) `
  "before=$($before.revision) after=$($after.dataRevision)"

$missing = @()
$changed = @()
foreach ($task in $before.tasks) {
  $match = $after.tasks | Where-Object { $_.id -eq $task.id }
  if (-not $match) { $missing += $task.id; continue }
  if ($match.revision -ne $task.revision) { $changed += "$($task.id): $($task.revision) -> $($match.revision)" }
}
Check 'every task id survived the restart' ($missing.Count -eq 0) $(if ($missing.Count) { "missing: $($missing -join ', ')" } else { "$($before.tasks.Count) tasks" })
Check 'every task keeps its revision stamp' ($changed.Count -eq 0) $(if ($changed.Count) { $changed -join '; ' } else { 'all revisions identical' })

Write-Host ''
Write-Host '-- both Clients reconnect on their own --'
foreach ($client in @(@{ port = 3102; name = 'A' }, @{ port = 3103; name = 'B' })) {
  $daily = (Invoke-WebRequest "http://127.0.0.1:$($client.port)/sooyo/daily" -UseBasicParsing -TimeoutSec 25).Content | ConvertFrom-Json
  Check "client $($client.name) reconnects and sees the same revision" ($daily.dataRevision -eq $after.dataRevision -and $daily.role -eq 'client') `
    "rev=$($daily.dataRevision) role=$($daily.role)"
}

Write-Host ''
$failed = @($results | Where-Object { -not $_.Ok })
Write-Host ("{0}/{1} checks passed" -f ($results.Count - $failed.Count), $results.Count)
if ($failed.Count -gt 0) {
  Write-Host ''
  Write-Host 'FAILED:'
  $failed | ForEach-Object { Write-Host "  $($_.Name)  -> $($_.Detail)" }
  exit 1
}
