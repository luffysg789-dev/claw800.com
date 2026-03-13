#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

MODE="${1:-catalog}"

if [[ "$MODE" != "catalog" && "$MODE" != "staging" ]]; then
  echo "[biteye-sync] usage: ./scripts/sync-biteye-crypto.sh [catalog|staging]"
  exit 1
fi

export CLAW800_DB_PATH="${CLAW800_DB_PATH:-/www/wwwroot/claw800-data/claw800.db}"

echo "[biteye-sync] root: $ROOT_DIR"
echo "[biteye-sync] db:   $CLAW800_DB_PATH"
echo "[biteye-sync] mode: $MODE"

if [[ ! -f package.json ]]; then
  echo "[biteye-sync] ERROR: package.json not found"
  exit 1
fi

if [[ ! -d node_modules ]]; then
  echo "[biteye-sync] installing dependencies"
  if [[ -f package-lock.json ]]; then
    npm ci --omit=dev
  else
    npm install --omit=dev
  fi
fi

if [[ "$MODE" == "staging" ]]; then
  node scripts/import-biteye-crypto-skills.js --staging
else
  node scripts/import-biteye-crypto-skills.js
fi

if command -v pm2 >/dev/null 2>&1; then
  if pm2 describe claw800 >/dev/null 2>&1; then
    echo "[biteye-sync] reloading pm2 app: claw800"
    pm2 reload claw800
  fi
fi

echo "[biteye-sync] done"
