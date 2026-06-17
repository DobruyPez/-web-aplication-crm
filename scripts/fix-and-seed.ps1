# fix-and-seed.ps1
$ComposeFile = "deploy/docker-compose.yml"

Write-Host "Stopping containers..." -ForegroundColor Yellow
docker compose -f $ComposeFile down

Write-Host "Removing volume..." -ForegroundColor Yellow
docker volume rm deploy_pgdata -f

Write-Host "Starting database only..." -ForegroundColor Yellow
docker compose -f $ComposeFile up -d db

Write-Host "Waiting for database..." -ForegroundColor Yellow
Start-Sleep -Seconds 10

Write-Host "Applying schema..." -ForegroundColor Yellow
docker compose -f $ComposeFile run --rm backend npx prisma db push --accept-data-loss

Write-Host "Seeding database..." -ForegroundColor Yellow
docker compose -f $ComposeFile run --rm backend node scripts/seed-bulk-load.js --docs-dir /app/uploads/docs --calls-dir /app/uploads/voice --voice-dir /app/uploads/voice --clear

Write-Host "Starting full stack..." -ForegroundColor Yellow
docker compose -f $ComposeFile up -d

Write-Host "`nDONE! UI: http://localhost:8088/" -ForegroundColor Green
Write-Host "Login: admin@demo.crm.by / 1234" -ForegroundColor Green