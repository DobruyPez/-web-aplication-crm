# CRM demo seed - local PostgreSQL.
# Run from repo root: .\scripts\seed-bulk-local.ps1
#   -SkipClear  -DryRun

param(
    [switch]$SkipClear,
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path $PSScriptRoot -Parent
$BackendRoot = Join-Path $RepoRoot "backend"
$DocsDir = Join-Path $BackendRoot "uploads\docs"
$VideoDir = Join-Path $BackendRoot "uploads\video"
$VoiceDir = Join-Path $BackendRoot "uploads\voice"

function Ensure-Dir([string]$Path) {
    if (-not (Test-Path $Path)) {
        New-Item -ItemType Directory -Force -Path $Path | Out-Null
    }
}

Ensure-Dir $DocsDir
Ensure-Dir $VideoDir
Ensure-Dir $VoiceDir

if (Test-Path $VideoDir) {
    Get-ChildItem -Path $VideoDir -File -ErrorAction SilentlyContinue | ForEach-Object {
        $dest = Join-Path $VoiceDir $_.Name
        if (-not (Test-Path $dest)) {
            Copy-Item -LiteralPath $_.FullName -Destination $dest -Force
        }
    }
}

$nodeArgs = @(
    "scripts/seed-bulk-load.js",
    "--docs-dir", $DocsDir,
    "--calls-dir", $VideoDir,
    "--voice-dir", $VoiceDir
)
if (-not $SkipClear) { $nodeArgs += "--clear" }
if ($DryRun) { $nodeArgs += "--dry-run" }

Write-Host ""
Write-Host "CRM demo seed - local" -ForegroundColor Cyan
Write-Host "  2 admins, 100 managers, 1000 clients, deals, tasks, calls, documents"
Write-Host "  Password: 1234 (or DEMO_SEED_PASSWORD)"
Write-Host "  Accounts: *@demo.crm.by"
Write-Host ""
Write-Host "Filter examples:" -ForegroundColor Yellow
Write-Host "  Clients - Address: Minsk, Notes: VIP or IT"
Write-Host "  Deals - product: license, title: OOO"
Write-Host "  Tasks - status in_progress, value BYN"
Write-Host ""

Push-Location $BackendRoot
try {
    & node @nodeArgs
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
} finally {
    Pop-Location
}

Write-Host ""
Write-Host "Login: admin@demo.crm.by  password 1234" -ForegroundColor Green
Write-Host "Managers: see Users list (*@demo.crm.by)" -ForegroundColor Green
