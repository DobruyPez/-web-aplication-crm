# Full CRM Docker deploy: build, up, wait for health, demo seed, print URLs.
# Run from repo root: .\scripts\deploy-docker-full.ps1
#   -SkipSeed       skip demo seed
#   -SkipClear      seed without DB clear
#   -RebuildBackend rebuild backend before seed

param(
    [switch]$SkipSeed,
    [switch]$SkipClear,
    [switch]$RebuildBackend
)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path $PSScriptRoot -Parent
$ComposeFile = Join-Path $RepoRoot "deploy\docker-compose.yml"
$EnvFile = Join-Path $RepoRoot "backend\.env"

if (-not (Test-Path $ComposeFile)) {
    throw "Compose file not found: $ComposeFile"
}
if (-not (Test-Path $EnvFile)) {
    Write-Host "Create backend\.env from backend\.env.example" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "CRM full Docker deploy" -ForegroundColor Cyan
Write-Host ""

Push-Location $RepoRoot
try {
    Write-Host "[1/4] Building images..." -ForegroundColor Gray
    docker compose -f $ComposeFile build
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

    Write-Host "[2/4] Starting containers..." -ForegroundColor Gray
    docker compose -f $ComposeFile up -d
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

    Write-Host "[3/4] Waiting for backend health..." -ForegroundColor Gray
    $deadline = (Get-Date).AddMinutes(3)
    $healthy = $false
    while ((Get-Date) -lt $deadline) {
        $status = docker compose -f $ComposeFile ps backend --format json 2>$null | ConvertFrom-Json -ErrorAction SilentlyContinue
        if ($status -and $status.Health -eq "healthy") {
            $healthy = $true
            break
        }
        Start-Sleep -Seconds 3
    }
    if (-not $healthy) {
        Write-Host "Backend not healthy yet. Check logs:" -ForegroundColor Yellow
        Write-Host "  docker compose -f deploy/docker-compose.yml logs backend --tail 50"
    }

    if (-not $SkipSeed) {
        Write-Host "[4/4] Demo database seed..." -ForegroundColor Gray
        $seedScript = Join-Path $RepoRoot "scripts\seed-bulk-docker.ps1"
        $seedArgs = @()
        if ($SkipClear) { $seedArgs += "-SkipClear" }
        if ($RebuildBackend) { $seedArgs += "-RebuildBackend" }
        & $seedScript @seedArgs
        if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    } else {
        Write-Host "[4/4] Seed skipped (-SkipSeed)" -ForegroundColor Gray
    }
} finally {
    Pop-Location
}

Write-Host ""
& (Join-Path $RepoRoot "deploy\print-access.ps1")
Write-Host ""
if (-not $SkipSeed) {
    Write-Host "Login after demo seed: admin@demo.crm.by  password 1234" -ForegroundColor Green
} else {
    Write-Host "Login (prisma seed): admin@crm.by  password 1234" -ForegroundColor Green
}
