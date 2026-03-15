#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

PORT="${PORT:-8500}"
PID_FILE="${NANOBANANA_PID_FILE:-./nanobanana.pid}"
LOG_FILE="${NANOBANANA_LOG_FILE:-./nanobanana.log}"

# Check if port already in use
if lsof -ti:"$PORT" >/dev/null 2>&1; then
  echo "Port $PORT already in use. Stop the service first with: ./stop-bg.sh"
  exit 1
fi

echo "──────────────────────────────────────────"
echo "  Nanobanana (Next.js)"
echo ""
echo "  URL:      http://127.0.0.1:${PORT}"
echo "  Log file: $LOG_FILE"
echo "──────────────────────────────────────────"

nohup pnpm run dev >> "$LOG_FILE" 2>&1 &
SERVICE_PID=$!
echo $SERVICE_PID > "$PID_FILE"

echo ""
echo "✓ Service started (PID: $SERVICE_PID)"
echo ""
echo "Commands:"
echo "  View logs:  tail -f $LOG_FILE"
echo "  Stop:      ./stop-bg.sh"
