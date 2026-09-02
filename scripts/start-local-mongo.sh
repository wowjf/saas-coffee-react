#!/usr/bin/env bash
#
# start-local-mongo.sh
#
# Starts the project-local portable MongoDB (self-contained, no system install).
# Data lives in .local-mongo/data and persists across restarts.
#
# Usage:
#   sh scripts/start-local-mongo.sh [port] [bind-ip]

set -euo pipefail

PORT="${1:-27017}"
BIND_IP="${2:-127.0.0.1}"

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MONGOD_PATH="$PROJECT_ROOT/.local-mongo/mongodb/bin/mongod"
DATA_PATH="$PROJECT_ROOT/.local-mongo/data"
LOG_PATH="$PROJECT_ROOT/.local-mongo/log/mongod.log"

if [ ! -f "$MONGOD_PATH" ]; then
  echo "ERROR: Portable MongoDB not found at $MONGOD_PATH" >&2
  exit 1
fi

mkdir -p "$DATA_PATH" "$(dirname "$LOG_PATH")"

if command -v ss >/dev/null 2>&1; then
  LISTENING_PID="$(ss -tlnp 2>/dev/null | grep ":$PORT " || true)"
  LISTENING_PID="$(printf '%s' "$LISTENING_PID" | grep -oE 'pid=[0-9]+' | head -1 | cut -d= -f2 || true)"
else
  LISTENING_PID="$(lsof -t -i "TCP:$PORT" 2>/dev/null | head -1 || true)"
fi

if [ -n "${LISTENING_PID:-}" ]; then
  if pgrep -P "$LISTENING_PID" -f "mongod.*$DATA_PATH" >/dev/null 2>&1 || tr '\0' ' ' < "/proc/$LISTENING_PID/cmdline" 2>/dev/null | grep -q "mongod.*$DATA_PATH"; then
    echo "MongoDB is already listening on $BIND_IP:$PORT."
    exit 0
  fi
  echo "ERROR: Port $PORT is already in use by PID $LISTENING_PID." >&2
  exit 1
fi

OUT_LOG="$PROJECT_ROOT/.runtime-logs/portable-mongod.out.log"
ERR_LOG="$PROJECT_ROOT/.runtime-logs/portable-mongod.err.log"
mkdir -p "$(dirname "$OUT_LOG")"

nohup "$MONGOD_PATH" \
  --dbpath "$DATA_PATH" \
  --logpath "$LOG_PATH" \
  --logappend \
  --bind_ip "$BIND_IP" \
  --port "$PORT" \
  >>"$OUT_LOG" 2>>"$ERR_LOG" &

MONGOD_PID=$!
sleep 3

if ! kill -0 "$MONGOD_PID" 2>/dev/null; then
  echo "ERROR: MongoDB exited during startup. See $LOG_PATH" >&2
  exit 1
fi

echo "MongoDB started on $BIND_IP:$PORT (PID $MONGOD_PID)."
echo "Data directory: $DATA_PATH"