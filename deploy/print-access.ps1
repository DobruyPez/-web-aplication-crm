$ErrorActionPreference = "Stop"
$here = $PSScriptRoot
$compose = Join-Path $here "docker-compose.yml"

function Get-PrimaryIPv4 {
    try {
        $candidates = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
            Where-Object {
                $_.IPAddress -notmatch "^(127\.|169\.254\.)" -and
                $_.PrefixOrigin -ne "WellKnown"
            } |
            Sort-Object -Property InterfaceMetric
        if ($candidates) { return ($candidates | Select-Object -First 1).IPAddress }
    } catch { }
    try {
        $h = [System.Net.Dns]::GetHostEntry([System.Net.Dns]::GetHostName())
        foreach ($a in $h.AddressList) {
            if ($a.AddressFamily -eq [System.Net.Sockets.AddressFamily]::InterNetwork -and $a.ToString() -notmatch "^127\.") {
                return $a.ToString()
            }
        }
    } catch { }
    return "localhost"
}

$ip = Get-PrimaryIPv4

Write-Host ""
Write-Host "CRM (Docker): доступ по сети с этого компьютера / сервера" -ForegroundColor Cyan
Write-Host "  HTTP (удобно с телефона в Wi‑Fi, без предупреждения сертификата):"
Write-Host "    http://${ip}:8088/" -ForegroundColor Green
Write-Host "  HTTPS (редирект с порта 80; на других устройствах сертификат mkcert не доверен):"
Write-Host "    https://${ip}/" -ForegroundColor Yellow
Write-Host ""
Write-Host "Compose-файл: $compose"
Write-Host ""
