# CRM demo seed in Docker.
# Run: .\scripts\seed-bulk-docker.ps1
#      .\scripts\seed-bulk-docker.ps1 -RebuildBackend
#      .\scripts\seed-bulk-docker.ps1 -SkipClear

param(
    [switch]$SkipClear,
    [switch]$DryRun,
    [switch]$RebuildBackend
)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path $PSScriptRoot -Parent
$ComposeFile = Join-Path $RepoRoot "deploy\docker-compose.yml"
$BackendHost = Join-Path $RepoRoot "backend"
$DocsHost = Join-Path $BackendHost "uploads\docs"
$VideoHost = Join-Path $BackendHost "uploads\video"
$UploadsDocs = Join-Path $RepoRoot "uploads\docs"
$UploadsVoice = Join-Path $RepoRoot "uploads\voice"

function Ensure-Dir([string]$Path) {
    if (-not (Test-Path $Path)) {
        New-Item -ItemType Directory -Force -Path $Path | Out-Null
    }
}

function Sync-Files([string]$Source, [string]$Dest) {
    Ensure-Dir $Dest
    if (-not (Test-Path $Source)) {
        Write-Host "  (folder missing) $Source" -ForegroundColor DarkYellow
        return 0
    }
    $count = 0
    Get-ChildItem -Path $Source -File -ErrorAction SilentlyContinue | ForEach-Object {
        $target = Join-Path $Dest $_.Name
        if (-not (Test-Path $target)) {
            Copy-Item -LiteralPath $_.FullName -Destination $target -Force
            $count++
        }
    }
    return $count
}

if (-not (Test-Path $ComposeFile)) {
    throw "Compose file not found: $ComposeFile"
}

Write-Host ""
Write-Host "CRM demo seed - Docker" -ForegroundColor Cyan
Write-Host "  Accounts: *@demo.crm.by  password 1234"
Write-Host ""

Ensure-Dir $DocsHost
Ensure-Dir $VideoHost
Ensure-Dir $UploadsDocs
Ensure-Dir $UploadsVoice

$copiedDocs = Sync-Files $DocsHost $UploadsDocs
$copiedVoice = Sync-Files $VideoHost $UploadsVoice
Write-Host "Sync uploads:" -ForegroundColor Gray
Write-Host "  docs:  $copiedDocs new"
Write-Host "  voice: $copiedVoice new"
Write-Host ""

if ($RebuildBackend) {
    Write-Host "Building backend..." -ForegroundColor Gray
    docker compose -f $ComposeFile build backend
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

# Формируем команду seed
$seedCmd = "docker compose -f `"$ComposeFile`" exec -T backend node scripts/seed-bulk-load.js --docs-dir /app/uploads/docs --calls-dir /app/uploads/voice --voice-dir /app/uploads/voice"

if (-not $SkipClear) { $seedCmd += " --clear" }
if ($DryRun) { $seedCmd += " --dry-run" }

Write-Host "Running seed in backend container..." -ForegroundColor Gray
Write-Host "Executing: $seedCmd" -ForegroundColor DarkGray
Invoke-Expression $seedCmd
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ""
Write-Host "Login: admin@demo.crm.by  password 1234" -ForegroundColor Green
Write-Host "UI: http://localhost:8088/" -ForegroundColor Gray