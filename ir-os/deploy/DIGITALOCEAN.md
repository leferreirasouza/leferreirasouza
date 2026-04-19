# IR-OS — DigitalOcean Deployment Guide

## 1. Create the Droplet

1. Log in to digitalocean.com → **Create → Droplets**
2. Choose:
   - **Region:** São Paulo (sao1) — lowest latency for Brazil
   - **OS:** Ubuntu 22.04 LTS
   - **Plan:** Basic → Regular → **$6/month** (1 vCPU, 1GB RAM, 25GB SSD)
     - Upgrade to $12/month (2GB RAM) if you run heavy Anthropic API calls frequently
   - **Authentication:** SSH Key (add your public key — more secure than password)
3. Click **Create Droplet**
4. Note the public IP address (e.g. `167.99.200.10`)

---

## 2. Point Your Domain (optional but recommended)

In your domain registrar (Registro.br, GoDaddy, Cloudflare, etc.):

```
Type: A
Name: iros          (creates iros.yourcompany.com.br)
Value: 167.99.200.10
TTL: 3600
```

Wait 5–15 minutes for DNS to propagate.

---

## 3. First-Time Server Setup (run once)

```bash
# Connect to the server
ssh root@167.99.200.10

# Download and run the setup script
# (replace with your domain, or omit if not using a domain yet)
bash <(curl -fsSL https://raw.githubusercontent.com/YOUR_REPO/main/ir-os/deploy/setup.sh) iros.yourcompany.com.br
```

This installs: Node.js 20, PM2, Nginx, Certbot, UFW firewall.

---

## 4. Deploy the Application (from your laptop)

```bash
# From your laptop, inside the ir-os/ directory:

# First deploy — push code + run build on the server
bash deploy/deploy.sh --remote root@167.99.200.10

# This will:
#  1. rsync your code to /opt/ir-os on the server
#  2. npm install + build frontend + build backend
#  3. Run database migrations
#  4. Start PM2 process
```

---

## 5. Create the .env File on the Server

```bash
ssh root@167.99.200.10

cp /opt/ir-os/.env.example /opt/ir-os/.env
nano /opt/ir-os/.env
```

Fill in these required values:

```env
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-sonnet-4-6

DATABASE_URL=/opt/ir-os/data/ir-os.db
AUDIT_LOG_PATH=/opt/ir-os/data/audit/audit.jsonl
UPLOAD_DIR=/opt/ir-os/uploads

JWT_SECRET=<generate with: openssl rand -hex 32>
API_PORT=3000

NODE_ENV=production
```

Then redeploy to pick up the new env:
```bash
bash /opt/ir-os/deploy/deploy.sh
```

---

## 6. Run First-Time Setup (create your admin user)

```bash
ssh root@167.99.200.10
cd /opt/ir-os
sudo -u iruser npx tsx scripts/setup.ts
```

This creates the database, your first user account, and first company profile.

---

## 7. Add SSL (HTTPS) with Let's Encrypt — Free

```bash
ssh root@167.99.200.10
sudo certbot --nginx -d iros.yourcompany.com.br
```

Certbot will:
- Get a free SSL certificate from Let's Encrypt
- Automatically configure Nginx for HTTPS
- Set up auto-renewal (runs every 12 hours via systemd timer)

After this, your dashboard is live at: **https://iros.yourcompany.com.br**

---

## 8. Every Time You Update the Code

From your laptop:

```bash
git add . && git commit -m "update"
git push

# Deploy to server
bash ir-os/deploy/deploy.sh --remote root@167.99.200.10
```

PM2 does a **zero-downtime reload** — the server never goes offline during updates.

---

## Useful Commands on the Server

```bash
# See real-time logs
pm2 logs ir-os

# Monitor CPU/memory live
pm2 monit

# Restart the app
pm2 restart ir-os

# Stop the app
pm2 stop ir-os

# See app status
pm2 list

# Nginx status
systemctl status nginx

# Renew SSL manually (auto-renews, but just in case)
certbot renew --dry-run
```

---

## Cost Summary

| Item | Cost |
|---|---|
| DigitalOcean Droplet (1GB) | $6/month |
| Domain (Registro.br) | ~R$40/year |
| SSL Certificate (Let's Encrypt) | Free |
| Anthropic API | Pay per token (~$3/MTok Sonnet) |
| **Total infrastructure** | **~$6/month** |

---

## Backup Strategy (optional)

DigitalOcean Backups add 20% to the droplet cost ($1.20/month for $6 droplet).
For SQLite, a simpler approach — add a daily cron on the server:

```bash
# Add to /etc/cron.daily/ir-os-backup
#!/bin/bash
cp /opt/ir-os/data/ir-os.db /opt/ir-os/data/ir-os.db.bak.$(date +%Y%m%d)
find /opt/ir-os/data -name "ir-os.db.bak.*" -mtime +7 -delete
```
