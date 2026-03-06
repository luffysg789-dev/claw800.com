#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/app"

if [ -z "${ADMIN_PASSWORD:-}" ]; then
  echo "ERROR: ADMIN_PASSWORD is empty"
  echo "Run: export ADMIN_PASSWORD='your-strong-password'"
  exit 1
fi

npm install --omit=dev

pm2 delete claw800 >/dev/null 2>&1 || true
pm2 start src/server.js --name claw800
pm2 save

echo "claw800 started by pm2"
pm2 status
