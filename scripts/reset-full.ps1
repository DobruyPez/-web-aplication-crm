# reset-full.ps1 (исправленная версия)
# Полный сброс и пересоздание среды
param([switch]$KeepUploads)

Write-Host "=== Полный сброс CRM ===" -ForegroundColor Cyan

Write-Host "1. Остановка контейнеров..." -ForegroundColor Gray
docker compose -f deploy/docker-compose.yml down

Write-Host "2. Удаление volume с БД..." -ForegroundColor Gray
docker volume rm deploy_postgres_data -f

if (-not $KeepUploads) {
    Write-Host "3. Очистка uploads..." -ForegroundColor Gray
    if (Test-Path "uploads/docs") { Remove-Item "uploads/docs/*" -Recurse -Force -ErrorAction SilentlyContinue }
    if (Test-Path "uploads/voice") { Remove-Item "uploads/voice/*" -Recurse -Force -ErrorAction SilentlyContinue }
}

Write-Host "4. Запуск контейнеров..." -ForegroundColor Gray
docker compose -f deploy/docker-compose.yml up -d

Write-Host "5. Ожидание готовности БД и бэкенда..." -ForegroundColor Gray
Start-Sleep -Seconds 15

Write-Host "6. Запуск seed..." -ForegroundColor Gray
.\scripts\seed-bulk-docker.ps1

Write-Host "`nГотово!" -ForegroundColor Green
Write-Host "UI: http://localhost:8088/" -ForegroundColor Gray