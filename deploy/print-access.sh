#!/usr/bin/env sh
# Вывод URL с локальным IP после docker compose up (Linux / macOS / Git Bash).

set -e
HERE=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
COMPOSE="$HERE/docker-compose.yml"

ip=""
if command -v hostname >/dev/null 2>&1; then
  ip=$(hostname -I 2>/dev/null | awk '{print $1}')
fi
if [ -z "$ip" ] && command -v ip >/dev/null 2>&1; then
  ip=$(ip -4 route get 1.1.1.1 2>/dev/null | awk '{for(i=1;i<=NF;i++) if($i=="src") {print $(i+1); exit}}')
fi
if [ -z "$ip" ]; then
  ip="localhost"
fi

echo ""
echo "CRM (Docker): доступ по сети"
echo "  HTTP (LAN без TLS):  http://${ip}:8088/"
echo "  HTTPS:               https://${ip}/"
echo ""
echo "Compose: $HERE/docker-compose.yml"
echo ""
