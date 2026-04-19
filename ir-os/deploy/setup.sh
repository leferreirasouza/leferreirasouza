#!/bin/bash
# =============================================================================
# IR-OS — DigitalOcean Droplet First-Time Setup
# =============================================================================
# Run this ONCE on a fresh Ubuntu 22.04 droplet as root.
#
# Usage:
#   ssh root@YOUR_DROPLET_IP
#   curl -fsSL https://raw.githubusercontent.com/YOUR_REPO/main/ir-os/deploy/setup.sh | bash
#
# Or copy the file and run: bash setup.sh YOUR_DOMAIN
# =============================================================================

set -euo pipefail

DOMAIN="${1:-}"
APP_DIR="/opt/ir-os"
APP_USER="iruser"
LOG_DIR="/var/log/ir-os"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
info()    { echo -e "${GREEN}[✓]${NC} $1"; }
warn()    { echo -e "${YELLOW}[!]${NC} $1"; }
section() { echo -e "\n${GREEN}══${NC} $1 ${GREEN}══${NC}"; }

# ── 0. Validate ───────────────────────────────────────────────────────────────
if [[ $EUID -ne 0 ]]; then
  echo -e "${RED}Run as root (sudo bash setup.sh)${NC}"; exit 1
fi

section "System update"
apt-get update -qq && apt-get upgrade -y -qq
apt-get install -y -qq curl git ufw nginx certbot python3-certbot-nginx build-essential
info "System packages installed"

# ── 1. Create app user ────────────────────────────────────────────────────────
section "App user"
if ! id "$APP_USER" &>/dev/null; then
  useradd -m -s /bin/bash "$APP_USER"
  info "Created user: $APP_USER"
else
  info "User $APP_USER already exists"
fi

# ── 2. Node.js 20 via nvm ─────────────────────────────────────────────────────
section "Node.js 20"
if ! command -v node &>/dev/null || [[ $(node --version | cut -d. -f1 | tr -d v) -lt 20 ]]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y -qq nodejs
  info "Node.js $(node --version) installed"
else
  info "Node.js $(node --version) already installed"
fi

# ── 3. PM2 ────────────────────────────────────────────────────────────────────
section "PM2"
npm install -g pm2 --silent
pm2 startup systemd -u "$APP_USER" --hp "/home/$APP_USER" | tail -1 | bash || true
info "PM2 installed and startup configured"

# ── 4. App directory & log directory ─────────────────────────────────────────
section "App directory"
mkdir -p "$APP_DIR" "$LOG_DIR" "$APP_DIR/data" "$APP_DIR/data/audit" "$APP_DIR/uploads"
chown -R "$APP_USER":"$APP_USER" "$APP_DIR" "$LOG_DIR"
info "Directories created at $APP_DIR"

# ── 5. Firewall ───────────────────────────────────────────────────────────────
section "Firewall (UFW)"
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow http
ufw allow https
ufw --force enable
info "Firewall configured (SSH + HTTP + HTTPS)"

# ── 6. Nginx ──────────────────────────────────────────────────────────────────
section "Nginx"
if [[ -n "$DOMAIN" ]]; then
  # Install our config
  sed "s/YOUR_DOMAIN/$DOMAIN/g" "$APP_DIR/deploy/nginx.conf" \
    > "/etc/nginx/sites-available/ir-os"
  ln -sf /etc/nginx/sites-available/ir-os /etc/nginx/sites-enabled/ir-os
  rm -f /etc/nginx/sites-enabled/default
  nginx -t && systemctl reload nginx
  info "Nginx configured for $DOMAIN"
else
  warn "No domain provided — skipping Nginx config (run with: bash setup.sh yourdomain.com)"
fi

# ── 7. Summary ────────────────────────────────────────────────────────────────
section "Setup complete"
echo ""
echo "  App directory : $APP_DIR"
echo "  Log directory : $LOG_DIR"
echo "  App user      : $APP_USER"
echo ""
echo "Next steps:"
echo "  1. Copy your repo to $APP_DIR   (see deploy.sh)"
echo "  2. Create $APP_DIR/.env          (copy .env.example and fill in values)"
echo "  3. Run: bash $APP_DIR/deploy/deploy.sh"
if [[ -n "$DOMAIN" ]]; then
  echo "  4. Add SSL: sudo certbot --nginx -d $DOMAIN"
fi
echo ""
