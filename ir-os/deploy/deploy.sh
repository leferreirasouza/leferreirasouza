#!/bin/bash
# =============================================================================
# IR-OS — Deploy / Update Script
# =============================================================================
# Run this every time you push new code and want to update the server.
#
# First deploy:
#   scp -r ./ir-os root@YOUR_DROPLET_IP:/opt/ir-os
#   ssh root@YOUR_DROPLET_IP "bash /opt/ir-os/deploy/deploy.sh"
#
# Subsequent deploys (from your laptop):
#   bash deploy/deploy.sh --remote root@YOUR_DROPLET_IP
#
# Or on the server itself:
#   cd /opt/ir-os && git pull && bash deploy/deploy.sh
# =============================================================================

set -euo pipefail

APP_DIR="/opt/ir-os"
APP_USER="iruser"

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
info()    { echo -e "${GREEN}[✓]${NC} $1"; }
warn()    { echo -e "${YELLOW}[!]${NC} $1"; }
section() { echo -e "\n${GREEN}──${NC} $1"; }

# ── Remote mode: push code to server, then SSH and run ───────────────────────
if [[ "${1:-}" == "--remote" ]]; then
  REMOTE="${2:?Usage: deploy.sh --remote user@host}"
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  REPO_ROOT="$(dirname "$SCRIPT_DIR")"

  echo "Syncing code to $REMOTE:$APP_DIR ..."
  rsync -az --delete \
    --exclude='.env' \
    --exclude='node_modules' \
    --exclude='frontend/node_modules' \
    --exclude='dist' \
    --exclude='public' \
    --exclude='data' \
    --exclude='uploads' \
    "$REPO_ROOT/" "$REMOTE:$APP_DIR/"

  echo "Running deploy on $REMOTE ..."
  ssh "$REMOTE" "bash $APP_DIR/deploy/deploy.sh"
  exit 0
fi

# ── Local mode: runs on the server ───────────────────────────────────────────
cd "$APP_DIR"

# Verify .env exists
if [[ ! -f "$APP_DIR/.env" ]]; then
  echo "ERROR: $APP_DIR/.env not found."
  echo "Copy .env.example to .env and fill in your values, then re-run."
  exit 1
fi

section "Installing backend dependencies"
npm ci --omit=dev --silent
info "Backend dependencies installed"

section "Installing frontend dependencies"
cd frontend && npm ci --silent && cd ..
info "Frontend dependencies installed"

section "Building frontend"
npm run ui:build
info "Frontend built → public/"

section "Building backend (TypeScript)"
npm run build
info "Backend compiled → dist/"

section "Running database migrations"
node -e "
  process.env.NODE_ENV = 'production';
  require('dotenv').config();
" 2>/dev/null || true
npx tsx src/data/migrations/run.ts
info "Migrations complete"

section "Setting ownership"
chown -R "$APP_USER":"$APP_USER" "$APP_DIR"
info "Ownership set to $APP_USER"

section "Starting / reloading PM2"
if pm2 describe ir-os &>/dev/null; then
  pm2 reload ecosystem.config.cjs --update-env
  info "PM2 process reloaded (zero-downtime)"
else
  pm2 start ecosystem.config.cjs
  pm2 save
  info "PM2 process started and saved"
fi

section "Deploy complete"
echo ""
pm2 list
echo ""
echo "Logs:  pm2 logs ir-os"
echo "Status: pm2 monit"
echo ""
