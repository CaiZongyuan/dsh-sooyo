# Remove the three E2E profiles and their isolated DSH homes.
#
# Stops any running instance first: deleting a profile out from under a live process leaves it
# serving a half-removed tree, and on Windows the directory removal fails on open handles.
#
# Usage: powershell -NoProfile -ExecutionPolicy Bypass -File dev/e2e-teardown.ps1

$ErrorActionPreference = 'Stop'

$profiles = @('sooyo-hub', 'sooyo-a', 'sooyo-b')
$ports = @(3101, 3102, 3103)

Write-Host '-- stopping any running E2E instance --'
Get-Process -Name node -ErrorAction SilentlyContinue | ForEach-Object {
  $command = (Get-CimInstance Win32_Process -Filter "ProcessId=$($_.Id)").CommandLine
  foreach ($profile in $profiles) {
    if ($command -like "*--profile $profile*") {
      Write-Host "  stopping pid $($_.Id) ($profile)"
      Stop-Process -Id $_.Id -Force
    }
  }
}
Start-Sleep -Seconds 3

foreach ($port in $ports) {
  $listening = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
  if ($listening) { Write-Host "  WARNING: port $port is still listening" }
}

Write-Host ''
Write-Host '-- removing the isolated homes --'
$base = Join-Path $env:DSH_HOME 'e2e'
if (Test-Path $base) {
  # Guard: only ever delete the e2e directory, never a computed path that resolved elsewhere.
  $resolved = (Resolve-Path $base).Path
  if ($resolved -ne $base) { throw "refusing to delete $resolved (expected $base)" }
  Remove-Item -Recurse -Force $base
  Write-Host "  removed $base"
} else {
  Write-Host "  $base does not exist"
}

Write-Host ''
Write-Host '-- removing any leftover profiles from an older layout --'
$profilesRoot = Join-Path $env:DSH_HOME 'profiles'
foreach ($profile in $profiles) {
  $dir = Join-Path $profilesRoot $profile
  if (Test-Path $dir) {
    Remove-Item -Recurse -Force $dir
    Write-Host "  removed $dir"
  }
}

Write-Host ''
Write-Host '-- verifying nothing is left --'
$left = @()
foreach ($profile in $profiles) {
  if (Test-Path (Join-Path $profilesRoot $profile)) { $left += $profile }
  if (Test-Path (Join-Path (Join-Path $base $profile) $profile)) { $left += "e2e/$profile" }
}
if ($left.Count -eq 0) {
  Write-Host '  clean: no E2E profile or home remains'
} else {
  Write-Host "  LEFT BEHIND: $($left -join ', ')"
  exit 1
}
