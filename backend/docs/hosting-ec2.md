# Hosting the backend on one EC2 server

How the DriveFlow API runs on a single Ubuntu server, with the database on the same machine. The setup steps are below, with what each one does, followed by the day-to-day commands.

```
phone app ──HTTPS──> Caddy (:443) ──> backend (127.0.0.1:4000) ──> Postgres (127.0.0.1:5432)
```

Only Caddy is reachable from the internet. The backend and the database listen on `127.0.0.1` only.

| Piece | Where |
| --- | --- |
| Code | `/opt/driveflow/app` (a git clone; the backend is in `backend/`) |
| Settings and secrets | `/etc/driveflow/backend.env` (readable by root and the `driveflow` user only) |
| Backend service | `driveflow-backend` (systemd) |
| HTTPS | Caddy, config in `/etc/caddy/Caddyfile` |
| Backups | `/var/backups/driveflow`, nightly at 02:30 UTC, 14 days kept |

## Connecting

Keep the `.pem` key in `~/.ssh` (never inside the project), readable only by you (`chmod 400`), and add an alias to `~/.ssh/config`:

```
Host driveflow-api
  HostName <server public DNS or IP>
  User ubuntu
  IdentityFile ~/.ssh/<key>.pem
  IdentitiesOnly yes
```

After that, `ssh driveflow-api` connects you.

## One-time setup

### 1. System updates, swap, firewall

```sh
sudo apt-get update && sudo apt-get upgrade -y      # security updates
sudo apt-get install -y git curl ufw ca-certificates
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile
echo "/swapfile none swap sw 0 0" | sudo tee -a /etc/fstab   # keep swap after reboot
sudo ufw allow OpenSSH && sudo ufw allow 80/tcp && sudo ufw allow 443/tcp && sudo ufw --force enable
```

- Swap is disk space used as extra memory. On a 2 GB server, it stops builds from running out of RAM.
- `ufw` is the server's own firewall. The AWS security group is a second firewall in front of it, and it should also allow only 22, 80 and 443.

### 2. Postgres and Node

```sh
sudo apt-get install -y postgresql nodejs npm
```

Ubuntu's own packages (Postgres 18, Node 22) get security updates through `apt`. Postgres listens only on `127.0.0.1` by default.

### 3. Service user, database and settings

```sh
sudo useradd --system --create-home --home-dir /opt/driveflow --shell /usr/sbin/nologin driveflow
sudo -u postgres psql -c "CREATE ROLE driveflow LOGIN PASSWORD '<random>';"
sudo -u postgres psql -c "CREATE DATABASE driveflow OWNER driveflow;"
```

- The app runs as `driveflow`, a user that can't log in and can only write to `/opt/driveflow`.
- The database has its own owner, so the app never uses the `postgres` superuser.
- Generate random values with `openssl rand -hex 24`, and `TOKEN_ENCRYPTION_KEY` with `openssl rand -base64 32`.

`/etc/driveflow/backend.env` (`chown root:driveflow`, `chmod 640`):

```
NODE_ENV=production
HOST=127.0.0.1
PORT=4000
TRUST_PROXY=true
DEV_MOCKS=false
DATABASE_URL=postgres://driveflow:<password>@127.0.0.1:5432/driveflow
TOKEN_ENCRYPTION_KEY=<openssl rand -base64 32>
API_PUBLIC_URL=https://api.driveflow.techgylink.com
SHARE_BASE_URL=https://driveflow.techgylink.com/p/
CORS_ORIGINS=https://driveflow.techgylink.com
EMAIL_PROVIDER=resend
RESEND_API_KEY=<from resend.com>
EMAIL_FROM=DriveFlow <no-reply@driveflow.techgylink.com>
GOOGLE_CLIENT_IDS=<web client id>
GOOGLE_OAUTH_CLIENT_ID=<web client id>
GOOGLE_OAUTH_CLIENT_SECRET=<web client secret>
ANTHROPIC_API_KEY=<key>
```

`TOKEN_ENCRYPTION_KEY` encrypts everyone's Google Drive tokens in the database. **Never change or lose it.** Without it, every user has to reconnect Drive. Store a copy in the company password manager.

Until Resend is set up, you can run with `NODE_ENV=development` and `EMAIL_PROVIDER=console`, keeping `DEV_MOCKS=false`. Everything is real, except that email sign-in codes are written to the log instead of being sent. Production mode refuses to start without real email.

### 4. Code and build

```sh
sudo -u driveflow -H bash -lc '
  cd /opt/driveflow && git clone --depth 1 https://github.com/poojadubey01/TechGy-DriveFlow.git app
  cd app/backend && npm ci && npm run build && npm prune --omit=dev'
```

- `npm ci` installs the exact versions in `package-lock.json`.
- `npm run build` compiles TypeScript to `dist/`.
- `npm prune --omit=dev` removes the build tools afterwards.

### 5. systemd service

`/etc/systemd/system/driveflow-backend.service`:

```ini
[Unit]
Description=DriveFlow backend API
After=network-online.target postgresql.service
Wants=network-online.target
Requires=postgresql.service

[Service]
User=driveflow
Group=driveflow
WorkingDirectory=/opt/driveflow/app/backend
EnvironmentFile=/etc/driveflow/backend.env
ExecStart=/usr/bin/node dist/index.js
Restart=always
RestartSec=3
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/opt/driveflow

[Install]
WantedBy=multi-user.target
```

```sh
sudo systemctl daemon-reload                       # pick up the new file
sudo systemctl enable --now driveflow-backend      # start now and on every boot
curl localhost:4000/health                         # {"ok":true,"database":"postgres"}
```

The backend applies database migrations itself every time it starts.

### 6. HTTPS with Caddy

```sh
sudo apt-get install -y caddy
```

`/etc/caddy/Caddyfile`:

```
api.driveflow.techgylink.com {
	encode zstd gzip
	reverse_proxy 127.0.0.1:4000
}
```

```sh
sudo systemctl reload caddy
```

Caddy gets a free Let's Encrypt certificate and renews it by itself. That only works once DNS has an **A record** pointing `api.driveflow` to the server's public IP (an Elastic IP, so the IP doesn't change), and port 80 is open.

### 7. Website: share links and app links

`driveflow.techgylink.com` serves:
- the deck pages clients open from share links (`/p/<code>`), which are the app's web build;
- the files that let the phone app open those links (`/.well-known/assetlinks.json`, and `apple-app-site-association` once there's an Apple Team ID);
- a simple homepage for everything else.

The app's web sign-in isn't set up for real Google yet, so no other app screen is served.

The files live in `/var/www/driveflow-web`, built on a Mac from `frontend/`:

```sh
cd frontend
rm -rf dist && EXPO_PUBLIC_API_URL=https://api.driveflow.techgylink.com npx expo export -p web
rsync -a --delete dist/ driveflow-api:/var/www/driveflow-web/
```

`frontend/public/` (the homepage, logo and `.well-known/`) is copied into `dist/` by the export.

In `/etc/caddy/Caddyfile`, next to the API site:

```
driveflow.techgylink.com {
	root * /var/www/driveflow-web
	encode zstd gzip

	header /_expo/static/* Cache-Control "public, max-age=31536000, immutable"
	header /.well-known/* Content-Type application/json

	handle /p/* {
		rewrite * /index.html
		file_server
	}
	handle {
		@home path /
		rewrite @home /welcome.html
		try_files {path} /welcome.html
		file_server
	}
}
```

The global `{ cert_issuer acme }` block at the top of the Caddyfile makes Caddy use Let's Encrypt only. Ubuntu's Caddy 2.6 can't register with ZeroSSL, its other default.

If Caddy tried to get a certificate before the DNS record existed, it waits longer and longer between retries. Run `sudo systemctl restart caddy` to retry straight away.

### 8. Nightly backups

A systemd timer (`driveflow-backup.timer`) runs `driveflow-backup.service`. It runs `pg_dump -Fc driveflow` into `/var/backups/driveflow/driveflow-YYYY-MM-DD.dump` and deletes dumps older than 14 days.

These backups are on the same disk as the database. Copy them off the server too (S3, or EBS snapshots) before real users depend on it.

## Day to day

| Task | Command |
| --- | --- |
| Is it up? | `curl https://api.driveflow.techgylink.com/health` |
| Service status | `systemctl status driveflow-backend` |
| Live logs | `sudo journalctl -u driveflow-backend -f` |
| Last 100 log lines | `sudo journalctl -u driveflow-backend -n 100 --no-pager` |
| Restart | `sudo systemctl restart driveflow-backend` |
| Change a setting | `sudo nano /etc/driveflow/backend.env`, then restart |
| Caddy / HTTPS logs | `sudo journalctl -u caddy -n 50 --no-pager` |
| Open the database | `sudo -u postgres psql driveflow` |
| Backup now | `sudo systemctl start driveflow-backup` |
| List backups | `sudo ls -lh /var/backups/driveflow` |
| OS updates | `sudo apt-get update && sudo apt-get upgrade -y` |

### Deploying a new version

```sh
sudo -u driveflow -H bash -lc '
  cd /opt/driveflow/app && git pull --ff-only
  cd backend && npm ci && npm run build && npm prune --omit=dev'
sudo systemctl restart driveflow-backend
curl localhost:4000/health
```

### Restoring a backup

```sh
sudo systemctl stop driveflow-backend
sudo -u postgres pg_restore --clean --if-exists -d driveflow /var/backups/driveflow/driveflow-YYYY-MM-DD.dump
sudo systemctl start driveflow-backend
```

### Viewing the data from your Mac (TablePlus)

Postgres isn't open to the internet, so connect through SSH. In TablePlus, create a PostgreSQL connection with **Over SSH**:

- SSH: the server address, user `ubuntu`, and your `.pem` key.
- Database: host `127.0.0.1`, port `5432`, user `driveflow`, database `driveflow`, and the password from `DATABASE_URL` in `backend.env` (`sudo grep DATABASE_URL /etc/driveflow/backend.env`).
