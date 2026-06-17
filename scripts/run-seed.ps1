# run-seed.ps1
$ComposeFile = "deploy/docker-compose.yml"

Write-Host "Seeding database..." -ForegroundColor Cyan
docker compose -f $ComposeFile exec -T backend node scripts/seed-bulk-load.js --docs-dir /app/uploads/docs --calls-dir /app/uploads/voice --voice-dir /app/uploads/voice --clear

if ($LASTEXITCODE -eq 0) {
    Write-Host "`nSUCCESS! Login: admin@demo.crm.by / 1234" -ForegroundColor Green
    Write-Host "UI: http://localhost:8088/" -ForegroundColor Cyan
} else {
    Write-Host "`nFAILED!" -ForegroundColor Red
}