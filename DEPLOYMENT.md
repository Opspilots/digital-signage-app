# Deployment Guide — Digital Signage

This guide covers deploying the Digital Signage app on TV/kiosk hardware (Raspberry Pi, Intel NUC, or any Linux machine) using Docker.

---

## Prerequisites

- **Docker** ≥ 24 — [install guide](https://docs.docker.com/engine/install/)
- **Docker Compose** ≥ 2.20 (included with Docker Desktop; on Linux install the `docker-compose-plugin`)
- Network access between the hardware and the Docker host (or both running on the same device)

---

## Quickstart

### 1. Clone the repository

```bash
git clone <repo-url> digital-signage
cd digital-signage
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` and at minimum set:

| Variable | Description | Example |
|---|---|---|
| `VITE_API_URL` | Backend URL **as seen from the browser** | `http://192.168.1.100:3001` |
| `CORS_ORIGIN` | Origin the backend allows | `http://192.168.1.100` |
| `JWT_SECRET` | Secret for future auth tokens | `openssl rand -hex 32` |

> **Important:** `VITE_API_URL` is baked into the frontend at build time. If you change it later, rebuild the frontend container (`docker compose build frontend`).

### 3. Start the stack

```bash
docker compose up -d
```

- **Frontend** — http://localhost (port 80)
- **Backend API** — http://localhost:3001
- **Health check** — http://localhost:3001/health

### 4. Verify

```bash
docker compose ps          # all services should show "running"
curl http://localhost:3001/health   # {"status":"ok"}
```

---

## Data Persistence

Two directories on the host are mounted as Docker volumes:

| Host path | Container path | Contents |
|---|---|---|
| `./data/` | `/app/data/` | SQLite database (`signage.db`) |
| `./uploads/` | `/app/uploads/` | Uploaded media files |

These directories are created automatically on first run. Back them up before updating the stack.

---

## Kiosk Mode (Chromium fullscreen)

### Launch command

```bash
chromium-browser \
  --kiosk \
  --noerrdialogs \
  --disable-infobars \
  --no-first-run \
  "http://localhost/playlists/<PLAYLIST_ID>/play?screen=<SCREEN_TOKEN>"
```

Replace `<PLAYLIST_ID>` with the playlist UUID from the admin UI and `<SCREEN_TOKEN>` with the screen identifier token.

### Hide the mouse cursor

```bash
unclutter -idle 0 &
```

---

## Auto-start on Boot

### Option A — Docker restart policy (recommended)

The `docker-compose.yml` already sets `restart: unless-stopped` for both services. Once started, the containers come back up automatically after a reboot — no extra config needed.

### Option B — systemd service

Create `/etc/systemd/system/digital-signage.service`:

```ini
[Unit]
Description=Digital Signage Docker stack
Requires=docker.service
After=docker.service network-online.target

[Service]
Type=simple
WorkingDirectory=/home/<user>/digital-signage
ExecStart=/usr/bin/docker compose up
ExecStop=/usr/bin/docker compose down
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Enable it:

```bash
sudo systemctl daemon-reload
sudo systemctl enable digital-signage
sudo systemctl start digital-signage
```

### Auto-launch Chromium after login (X11 / LXDE)

Add to `~/.config/lxsession/LXDE/autostart`:

```
@/usr/bin/chromium-browser --kiosk --noerrdialogs --disable-infobars --no-first-run "http://localhost/playlists/<PLAYLIST_ID>/play?screen=<SCREEN_TOKEN>"
```

Or create `~/.config/autostart/kiosk.desktop`:

```ini
[Desktop Entry]
Type=Application
Name=Digital Signage Kiosk
Exec=chromium-browser --kiosk --noerrdialogs --disable-infobars --no-first-run "http://localhost/playlists/<PLAYLIST_ID>/play?screen=<SCREEN_TOKEN>"
X-GNOME-Autostart-enabled=true
```

---

## Updating

```bash
git pull
docker compose build   # rebuild images with latest code
docker compose up -d   # rolling restart (data volumes untouched)
```

---

## Troubleshooting

### Frontend loads but can't reach the backend

- Check `VITE_API_URL` in `.env` matches the actual backend host/port visible from the browser.
- Rebuild the frontend after any `.env` change: `docker compose build frontend && docker compose up -d frontend`.

### `docker compose up` fails with port 80 already in use

Another process (often nginx/apache on the host) is using port 80. Either stop that service or change the frontend port mapping in `docker-compose.yml`:

```yaml
ports:
  - "8080:80"
```

Then point Chromium at `http://localhost:8080`.

### Media uploads fail

Check that the `uploads/` directory on the host is writable by the Docker process:

```bash
chmod -R 755 uploads/
```

### Database errors on startup

The SQLite file lives in `./data/signage.db`. If it gets corrupted, back it up and remove it — the backend will recreate the schema on next startup (data loss warning).

```bash
cp data/signage.db data/signage.db.bak
rm data/signage.db
docker compose restart backend
```

### View logs

```bash
docker compose logs -f            # both services
docker compose logs -f backend    # backend only
docker compose logs -f frontend   # nginx access/error logs
```
