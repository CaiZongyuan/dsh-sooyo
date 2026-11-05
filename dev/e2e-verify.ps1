# Verify the sooyo sync layer against three real DSH instances.
#
# Prerequisite: `dev/e2e-setup.ps1` created the profiles and all three are booted:
#   hub     http://127.0.0.1:3101   role=hub     (authoritative)
#   clientA http://127.0.0.1:3102   role=client  (write token)
#   clientB http://127.0.0.1:3103   role=client  (read token)
#
# Every check below is one acceptance criterion from issue #1, exercised over real HTTP against
# three separate processes with three separate storage roots. Nothing here reaches into the
# plugin's internals: if a check passes, it passed through the same routes a browser uses.
#
# NB: hashtables are always built in their own statement before being passed. PowerShell 5.1's
# parser rejects a nested `@{ ... }` inside a command's argument list once it contains `;`.
#
# Usage: powershell -NoProfile -ExecutionPolicy Bypass -File dev/e2e-verify.ps1

$ErrorActionPreference = 'Stop'
$HUB = 'http://127.0.0.1:3101'
$A = 'http://127.0.0.1:3102'
$B = 'http://127.0.0.1:3103'
$WRITE_TOKEN = 'e2e-hub-write-token-0123456789'
$READ_TOKEN = 'e2e-hub-read-token-0123456789'

# Every run mints its own operation ids.
#
# Reusing a fixed id would be wrong in two ways: the Hub's idempotency log answers a second run
# from the first run's stored result (so a re-run would assert stale data), and the first run's
# record — written before a fix — would keep an outdated title alive forever. The prefix makes a
# re-run independent while staying path-safe, since the Hub stores it as a record key.
$RUN = 'r' + (Get-Date -Format 'MMddHHmmss')
Write-Host "run id: $RUN"

# Both harness bugs this script used to have came from `$script:` inside a function.
#
# `$script:results += $item` rebinds the array in the script scope, and the appended item can be
# lost across the call — the run printed a FAIL line and then reported "37/37 passed". A green
# summary over a red line is worse than a red run, so the harness appends to one ArrayList with
# no scope qualifier, and computes the failure count from that same list.
$results = New-Object System.Collections.ArrayList
function Check([string]$name, [bool]$ok, [string]$detail = '') {
  [void]$results.Add([pscustomobject]@{ Name = $name; Ok = $ok; Detail = $detail })
  $mark = if ($ok) { 'PASS' } else { 'FAIL' }
  $suffix = if ($detail) { "  -> $detail" } else { '' }
  Write-Host ("{0}  {1}{2}" -f $mark, $name, $suffix)
}

function Get-Json([string]$url) {
  return (Invoke-WebRequest $url -UseBasicParsing -TimeoutSec 30).Content | ConvertFrom-Json
}

# PowerShell 5.1 has two traps that both corrupt a request body:
#
#  1. A `-Body <string>` is sent as ASCII, so a Chinese title arrives as `?????` and the round-trip
#     proves nothing.
#  2. A `-Body <byte[]>` is re-encoded and arrives malformed, which the Hub rejects with an empty
#     400 that looks like a server bug.
#
# The only reliable form is a UTF-8 file written to disk and sent with `-InFile`, which is why
# every POST below goes through this helper.
$script:bodyFile = Join-Path $env:TEMP 'sooyo-e2e-body.json'

function Write-BodyFile($body) {
  $json = $body | ConvertTo-Json -Depth 12 -Compress
  [System.IO.File]::WriteAllText($script:bodyFile, $json, (New-Object System.Text.UTF8Encoding($false)))
  return $script:bodyFile
}

function Post-Json([string]$url, $body) {
  $file = Write-BodyFile $body
  $response = Invoke-WebRequest $url -UseBasicParsing -TimeoutSec 30 -Method POST -InFile $file `
    -ContentType 'application/json; charset=utf-8'
  return $response.Content | ConvertFrom-Json
}

# A POST that may legitimately fail: returns status + parsed body.
#
# Reading an error body is not possible through `Invoke-WebRequest` in PowerShell 5.1: the
# cmdlet consumes the response stream before it throws, so reading `GetResponseStream()` on the
# caught exception yields zero bytes even though `Content-Length` says 360. That looked exactly
# like a Hub sending an empty 409 and cost two rounds of chasing a bug that did not exist.
#
# `HttpWebRequest` leaves the error response readable, so it is the client this helper uses. It
# is the same wire call, just without the cmdlet's error handling in the middle.
function Try-Post([string]$url, $body, [hashtable]$headers = @{}) {
  $file = Write-BodyFile $body
  $bytes = [System.IO.File]::ReadAllBytes($file)

  $request = [System.Net.HttpWebRequest]::Create($url)
  $request.Method = 'POST'
  $request.ContentType = 'application/json; charset=utf-8'
  $request.ContentLength = $bytes.Length
  $request.Timeout = 30000
  foreach ($key in $headers.Keys) { $request.Headers.Add($key, $headers[$key]) }

  $input = $request.GetRequestStream()
  $input.Write($bytes, 0, $bytes.Length)
  $input.Close()

  $status = 0
  $text = ''
  try {
    $response = $request.GetResponse()
    $status = [int]$response.StatusCode
    $reader = New-Object System.IO.StreamReader($response.GetResponseStream(), [System.Text.Encoding]::UTF8)
    $text = $reader.ReadToEnd()
    $reader.Close()
    $response.Close()
  } catch [System.Net.WebException] {
    $web = $_.Exception
    if (-not $web.Response) { return @{ status = 0; body = $null; raw = '' } }
    $status = [int]$web.Response.StatusCode
    $reader = New-Object System.IO.StreamReader($web.Response.GetResponseStream(), [System.Text.Encoding]::UTF8)
    $text = $reader.ReadToEnd()
    $reader.Close()
    $web.Response.Close()
  }

  $parsed = $null
  if ($text) { try { $parsed = $text | ConvertFrom-Json } catch { $parsed = $null } }
  return @{ status = $status; body = $parsed; raw = $text }
}

# One Hub sync call.
function Sync([string]$path, [string]$method = 'GET', $body = $null, [string]$token = $WRITE_TOKEN, [hashtable]$extra = @{}) {
  $headers = @{ Authorization = "Bearer $token" }
  foreach ($key in $extra.Keys) { $headers[$key] = $extra[$key] }
  if ($method -eq 'GET') {
    try {
      $response = Invoke-WebRequest "$HUB/sooyo/sync/v1$path" -UseBasicParsing -TimeoutSec 30 -Headers $headers
      return @{ status = [int]$response.StatusCode; body = ($response.Content | ConvertFrom-Json); etag = $response.Headers['ETag'] }
    } catch {
      $status = 0
      $parsed = $null
      if ($_.Exception.Response) {
        $status = [int]$_.Exception.Response.StatusCode
        try { $parsed = (New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())).ReadToEnd() | ConvertFrom-Json } catch { }
      }
      return @{ status = $status; body = $parsed; etag = $null }
    }
  }
  return Try-Post "$HUB/sooyo/sync/v1$path" $body $headers
}

Write-Host ''
Write-Host '== 0. all three instances answer with the expected role =='
$instances = @(
  @{ port = 3101; role = 'hub' },
  @{ port = 3102; role = 'client' },
  @{ port = 3103; role = 'client' }
)
foreach ($instance in $instances) {
  $ping = Get-Json "http://127.0.0.1:$($instance.port)/sooyo/ping"
  Check "instance on $($instance.port) reports role=$($instance.role)" ($ping.role -eq $instance.role -and $ping.ready) "ready=$($ping.ready) role=$($ping.role)"
}

Write-Host ''
Write-Host '== 1. the Hub serves the seeded dashboard =='
$hubDaily = Get-Json "$HUB/sooyo/daily"
Check 'hub serves /daily with the seeded Boards' ($hubDaily.ready -and $hubDaily.boards.Count -ge 4) "boards=$($hubDaily.boards.Count)"
$hubRevisionStart = $hubDaily.dataRevision

Write-Host ''
Write-Host '== 2. AC-01 -- a Todo created on the Hub is visible from a Client =='
$createBody = @{
  protocolVersion = 1
  operationId = "$RUN-task-001"
  name = 'task.add'
  body = @{ title = 'E2E 同步验证任务'; list = 'today' }
}
$createHeaders = @{ Authorization = "Bearer $WRITE_TOKEN" }
$created = Try-Post "$HUB/sooyo/sync/v1/command" $createBody $createHeaders
$createDetail = "status=$($created.status) code=$($created.body.error.code) msg=$($created.body.error.message)"
Check 'hub accepted task.add over the sync API' ($created.status -eq 200 -and $created.body.ok) $createDetail
$taskId = $created.body.result.task.id
$taskRevision = $created.body.result.task.revision

$clientDaily = Get-Json "$A/sooyo/daily"
$onClient = $clientDaily.tasks | Where-Object { $_.id -eq $taskId }
$clientTitle = if ($onClient) { $onClient.title } else { '' }
Check 'client A reads the same task id and title' ($null -ne $onClient -and $clientTitle -eq 'E2E 同步验证任务') "id=$taskId title=$clientTitle"
$clientBDaily = Get-Json "$B/sooyo/daily"
Check 'client B reads the same task too' ($null -ne ($clientBDaily.tasks | Where-Object { $_.id -eq $taskId }))
# The revision advances by one per committed command, and the create was the only write, so all
# three must now agree on `start + 1`. Comparing the three to each other is the real assertion: a
# Client that answered from its own cache would report a different number and fail here.
$revisionOk = ($clientDaily.dataRevision -eq $hubRevisionStart + 1) -and ($clientBDaily.dataRevision -eq $clientDaily.dataRevision)
$revisionDetail = "hub was $hubRevisionStart; A=$($clientDaily.dataRevision) B=$($clientBDaily.dataRevision)"
Check 'all three report the same dataRevision' $revisionOk $revisionDetail

Write-Host ''
Write-Host '== 3. AC-03 -- retrying the same operationId does not create a second task =='
$beforeCount = (Get-Json "$HUB/sooyo/daily").tasks.Count
$retry = Try-Post "$HUB/sooyo/sync/v1/command" $createBody $createHeaders
$afterCount = (Get-Json "$HUB/sooyo/daily").tasks.Count
Check 'the retry is answered from the idempotency log' ($retry.body.replayed -eq $true) "replayed=$($retry.body.replayed)"
Check 'the retry names the same task id' ($retry.body.result.task.id -eq $taskId)
Check 'the task count did not grow' ($afterCount -eq $beforeCount) "$beforeCount -> $afterCount"

Write-Host ''
Write-Host '== 4. AC-02 -- a concurrent edit is a 409, not a silent overwrite =='
$precondition = @{ entity = 'task'; id = $taskId; revision = $taskRevision }

$firstBody = @{
  protocolVersion = 1
  operationId = "$RUN-write-a1"
  name = 'task.update'
  body = @{ id = $taskId; done = $true }
  precondition = $precondition
}
$first = Try-Post "$HUB/sooyo/sync/v1/command" $firstBody $createHeaders
Check 'the first writer wins with a matching revision' ($first.body.ok -eq $true) "err=$($first.body.error.message)"

$secondBody = @{
  protocolVersion = 1
  operationId = "$RUN-write-b1"
  name = 'task.update'
  body = @{ id = $taskId; title = 'B 同时改标题' }
  precondition = $precondition
}
$second = Try-Post "$HUB/sooyo/sync/v1/command" $secondBody $createHeaders
Check 'the stale writer gets 409' ($second.status -eq 409) "status=$($second.status)"
# `details.current` is where a 409 carries the record the caller lost to, so the UI can show both
# versions instead of overwriting. Asserting the title — not merely non-null — proves the whole
# record travelled, which is what makes the conflict actionable rather than just refused.
$conflictDetails = $second.body.error.details
$conflictRecord = $conflictDetails.current
$conflictTitle = if ($conflictRecord) { $conflictRecord.title } else { '' }
$conflictDeets = "hasDetails=$($null -ne $conflictDetails) title=$conflictTitle"
Check 'the 409 carries the current record for a diff' ($null -ne $conflictRecord -and $conflictTitle -eq 'E2E 同步验证任务') $conflictDeets
$unchanged = (Get-Json "$HUB/sooyo/daily").tasks | Where-Object { $_.id -eq $taskId }
Check 'the refused write changed nothing' ($unchanged.title -eq 'E2E 同步验证任务') "title=$($unchanged.title)"

Write-Host ''
Write-Host '== 5. AC-06 -- a bad or read-only token cannot write =='
$addOne = @{ protocolVersion = 1; name = 'task.add'; body = @{ title = 'x' } }
$noTokenBody = $addOne.Clone(); $noTokenBody.operationId = "$RUN-notoken"
$noToken = Try-Post "$HUB/sooyo/sync/v1/command" $noTokenBody @{}
Check 'a command with no token is 401' ($noToken.status -eq 401) "status=$($noToken.status)"

$badTokenBody = $addOne.Clone(); $badTokenBody.operationId = "$RUN-badtoken"
$badHeaders = @{ Authorization = 'Bearer not-a-real-token-000000' }
$badToken = Try-Post "$HUB/sooyo/sync/v1/command" $badTokenBody $badHeaders
Check 'a command with a wrong token is 401' ($badToken.status -eq 401) "status=$($badToken.status)"

$readOnlyBody = $addOne.Clone(); $readOnlyBody.operationId = "$RUN-readonly"
$readHeaders = @{ Authorization = "Bearer $READ_TOKEN" }
$readOnlyWrite = Try-Post "$HUB/sooyo/sync/v1/command" $readOnlyBody $readHeaders
Check 'a read-only token cannot write (403)' ($readOnlyWrite.status -eq 403) "status=$($readOnlyWrite.status)"

$readOnlyRead = Sync '/snapshot' 'GET' $null $READ_TOKEN
Check 'a read-only token can still read' ($readOnlyRead.status -eq 200) "status=$($readOnlyRead.status)"

Write-Host ''
Write-Host '== 6. persistent state and conditional requests (AC-04) =='
$snapshot = Sync '/snapshot' 'GET'
Check 'the snapshot still lists the task after the writes' ($null -ne ($snapshot.body.tasks | Where-Object { $_.id -eq $taskId })) "rev=$($snapshot.body.dataRevision)"
Check 'the snapshot exposes an ETag keyed to dataRevision' ($snapshot.etag -like "*$($snapshot.body.dataRevision)*") "etag=$($snapshot.etag)"
$conditional = Sync '/snapshot' 'GET' $null $WRITE_TOKEN @{ 'If-None-Match' = $snapshot.etag }
Check 'a matching If-None-Match returns 304 (no re-download)' ($conditional.status -eq 304) "status=$($conditional.status)"

# AC-04's durability half cannot prove itself in one process: the write and the read share memory.
# The state is written to a file so `dev/e2e-restart.ps1` can restart the Hub and compare every
# task id and revision against what this run saw.
$stateFile = Join-Path $env:TEMP 'sooyo-e2e-before-restart.json'
$stateRecord = @{ revision = $snapshot.body.dataRevision; tasks = $snapshot.body.tasks }
$stateRecord | ConvertTo-Json -Depth 6 | Set-Content -Path $stateFile -Encoding UTF8
Write-Host "  wrote $stateFile — run dev/e2e-restart.ps1 to prove AC-04's durability half"

Write-Host ''
Write-Host '== 7. AC-07 -- only the Hub fetches Sources =='
$emptyBody = @{}
$clientRefresh = Try-Post "$A/sooyo/refresh" $emptyBody @{}
Check 'client A refuses to fetch (503)' ($clientRefresh.status -eq 503) "status=$($clientRefresh.status)"
$clientThumbs = Try-Post "$A/sooyo/thumbnails" $emptyBody @{}
Check 'client A refuses a cover pass too' ($clientThumbs.status -eq 503) "status=$($clientThumbs.status)"

Write-Host ''
Write-Host '== 8. AC-05 -- a Client holds no authoritative copy =='
Check 'client B serves the Hub copy, not its own Boards' ($clientBDaily.boards.Count -eq $hubDaily.boards.Count -and $clientBDaily.role -eq 'client') "boards=$($clientBDaily.boards.Count) role=$($clientBDaily.role)"
Check 'client B has no sooyo storage domain on its own disk' (-not (Test-Path 'C:\Users\zongy\.dsh\e2e\b\storages\sooyo')) 'checked the isolated storage root'
Check 'client A has no sooyo storage domain either' (-not (Test-Path 'C:\Users\zongy\.dsh\e2e\a\storages\sooyo')) 'checked the isolated storage root'
Check 'the Hub does have one' (Test-Path 'C:\Users\zongy\.dsh\e2e\hub\storages\sooyo') 'hub storage root exists'

Write-Host ''
Write-Host '== 9. migration -- export / dry-run import / conflicts =='
$exported = Get-Json "$HUB/sooyo/export"
Check 'GET /sooyo/export names its format and counts' ($exported.kind -eq 'sooyo-export' -and $null -ne $exported.counts.tasks) "tasks=$($exported.counts.tasks)"
Check 'the export carries no fetched Items' ($null -eq $exported.tables.items) 'items excluded by design'
$importBody = @{ document = $exported }
$dry = Post-Json "$HUB/sooyo/import" $importBody
Check 're-importing the same export is a no-op dry run' ($dry.summary.create -eq 0 -and $dry.summary.identical -gt 0) "create=$($dry.summary.create) identical=$($dry.summary.identical)"
Check 'the dry run writes nothing' ($dry.wouldWrite -eq 0) "wouldWrite=$($dry.wouldWrite)"
Check 'the dry run explains itself in plain lines' ($dry.description.Count -gt 1) "$($dry.description[0])"

Write-Host ''
Write-Host '== 10. a Client reaches the Hub for data and tools =='
$clientMeta = Get-Json "$A/sooyo/meta"
Check 'client A has no Items of its own' ($clientMeta.itemCount -eq 0) "itemCount=$($clientMeta.itemCount)"
Check 'client A reports its sync role' ($clientMeta.sync.role -eq 'client') "role=$($clientMeta.sync.role)"
$hubMeta = Get-Json "$HUB/sooyo/meta"
Check 'the Hub is the one with fetched Items' ($hubMeta.itemCount -gt 0) "hub items=$($hubMeta.itemCount)"
$inbox = Get-Json "$A/sooyo/agent-inbox"
Check 'the Agent Inbox is readable from a Client' ($inbox.ok -eq $true) "proposals=$($inbox.proposals.Count)"

Write-Host ''
$failed = @($results | Where-Object { -not $_.Ok })
Write-Host ("{0}/{1} checks passed" -f ($results.Count - $failed.Count), $results.Count)
if ($failed.Count -gt 0) {
  Write-Host ''
  Write-Host 'FAILED:'
  $failed | ForEach-Object { Write-Host "  $($_.Name)  -> $($_.Detail)" }
  exit 1
}
