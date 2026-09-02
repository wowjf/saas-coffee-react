#!/usr/bin/env bash
#
# stop-local-mongo.sh
#
# Stops the project-local MongoDB started by start-local-mongo.sh.
#
# Usage:
#   sh scripts/stop-local-mongo.sh

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DATA_PATH="$PROJECT_ROOT/.local-mongo/data"

PIDS="$(pgrep -f "mongod.*$DATA_PATH" || true)"

if [ -z "$PIDS" ]; then
  echo "No local MongoDB process is running."
  exit 0
fi

echo "Stopping MongoDB (PIDs: $PIDS)..."
echo "$PIDS" | xargs -r kill 2>/dev/null || true
sleep 2

STILL="$(pgrep -f "mongod.*$DATA_PATH" || true)"
if [ -n "$STILL" ]; then
  echo "Force stopping remaining processes (PIDs: $STILL)..."
  echo "$STILL" | xargs -r kill -9 2>/dev/null || true
fi

echo "MongoDB stopped."