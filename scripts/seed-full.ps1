# seed-full.ps1 - Full database seed with 1000+ records
# Run: .\scripts\seed-full.ps1

param(
    [switch]$RebuildBackend
)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path $PSScriptRoot -Parent
$ComposeFile = Join-Path $RepoRoot "deploy\docker-compose.yml"

Write-Host ""
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host "   CRM FULL SEED - 1000+ records" -ForegroundColor Cyan
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host ""

# 1. Rebuild backend if needed
if ($RebuildBackend) {
    Write-Host "[1/6] Rebuilding backend..." -ForegroundColor Gray
    docker compose -f $ComposeFile build backend
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

# 2. Stop and remove volume
Write-Host "[2/6] Stopping containers and removing database..." -ForegroundColor Gray
docker compose -f $ComposeFile down -v
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

# 3. Start containers
Write-Host "[3/6] Starting containers..." -ForegroundColor Gray
docker compose -f $ComposeFile up -d
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

# 4. Wait for db-bootstrap to finish (schema creation)
Write-Host "[4/6] Waiting for db-bootstrap (schema creation)..." -ForegroundColor Gray
$maxAttempts = 60
$bootstrapDone = $false
for ($i = 1; $i -le $maxAttempts; $i++) {
    $status = docker inspect deploy-db-bootstrap-1 --format='{{.State.Status}}' 2>$null
    $exitCode = docker inspect deploy-db-bootstrap-1 --format='{{.State.ExitCode}}' 2>$null
    
    if ($status -eq "exited" -and $exitCode -eq "0") {
        Write-Host "  db-bootstrap completed successfully!" -ForegroundColor Green
        $bootstrapDone = $true
        break
    }
    if ($i -eq $maxAttempts) {
        Write-Host "  ERROR: db-bootstrap failed or timeout" -ForegroundColor Red
        docker compose -f $ComposeFile logs db-bootstrap --tail 30
        exit 1
    }
    Write-Host "  Waiting... ($i/$maxAttempts)" -ForegroundColor DarkGray
    Start-Sleep -Seconds 2
}

# 5. Wait for backend ready
Write-Host "[5/6] Waiting for backend..." -ForegroundColor Gray
$maxAttempts = 60
for ($i = 1; $i -le $maxAttempts; $i++) {
    $health = docker inspect --format='{{.State.Health.Status}}' deploy-backend-1 2>$null
    if ($health -eq "healthy") {
        Write-Host "  Backend is ready!" -ForegroundColor Green
        break
    }
    if ($i -eq $maxAttempts) {
        Write-Host "  ERROR: Backend failed to start" -ForegroundColor Red
        docker compose -f $ComposeFile logs backend --tail 30
        exit 1
    }
    Start-Sleep -Seconds 2
}

# 6. Run seed inside container
Write-Host "[6/6] Seeding database with 1000+ records..." -ForegroundColor Gray
$seedCmd = "docker compose -f `"$ComposeFile`" exec -T backend node scripts/seed-bulk-load.js --docs-dir /app/uploads/docs --calls-dir /app/uploads/voice --voice-dir /app/uploads/voice --clear"

Write-Host "Executing: $seedCmd" -ForegroundColor DarkGray
Invoke-Expression $seedCmd

if ($LASTEXITCODE -ne 0) {
    Write-Host "`n[ERROR] Seed failed!" -ForegroundColor Red
    exit $LASTEXITCODE
}

Write-Host ""
Write-Host "===============================================" -ForegroundColor Green
Write-Host "   DONE!" -ForegroundColor Green
Write-Host "===============================================" -ForegroundColor Green
Write-Host ""
Write-Host "Data created:" -ForegroundColor Yellow
Write-Host "  * 2 admins" -ForegroundColor White
Write-Host "  * 100 managers" -ForegroundColor White
Write-Host "  * 1000 clients" -ForegroundColor White
Write-Host "  * 1000 deals" -ForegroundColor White
Write-Host "  * 15000 tasks" -ForegroundColor White
Write-Host "  * ~10000 calls" -ForegroundColor White
Write-Host "  * ~10000 documents" -ForegroundColor White
Write-Host ""
Write-Host "Login: admin@demo.crm.by" -ForegroundColor Green
Write-Host "Password: 1234" -ForegroundColor Green
Write-Host ""
Write-Host "URL: http://localhost:8088/" -ForegroundColor Cyan
Write-Host ""