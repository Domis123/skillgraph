#!/bin/sh
# start.sh — Seeds vault volume on first run, then starts API

VAULT_DIR="${VAULT_PATH:-/app/vault}"
SEED_DIR="./vault-seed"

# Also check /app/vault-seed for Nixpacks builds
if [ ! -d "$SEED_DIR" ] && [ -d "/app/vault-seed" ]; then
  SEED_DIR="/app/vault-seed"
fi
if [ ! -d "$SEED_DIR" ] && [ -d "/app/api/vault-seed" ]; then
  SEED_DIR="/app/api/vault-seed"
fi

echo "[skillgraph] Checking vault at $VAULT_DIR..."

# Check if vault volume is empty (no .md files)
MD_COUNT=$(find "$VAULT_DIR" -name "*.md" 2>/dev/null | wc -l)

if [ "$MD_COUNT" -eq 0 ] && [ -d "$SEED_DIR" ]; then
  echo "[skillgraph] Volume is empty. Seeding from $SEED_DIR..."
  cp -r "$SEED_DIR"/* "$VAULT_DIR"/
  NEW_COUNT=$(find "$VAULT_DIR" -name "*.md" | wc -l)
  echo "[skillgraph] Seeded $NEW_COUNT files into vault volume."
else
  echo "[skillgraph] Vault has $MD_COUNT markdown files. Skipping seed."
fi

echo "[skillgraph] Starting API..."
exec node dist/index.js
