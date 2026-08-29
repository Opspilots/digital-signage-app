# Digital Signage - Manual QA Testing Checklist

## Overview
This checklist covers manual testing procedures for the Digital Signage application across different deployment scenarios. Use this before each release to ensure the application meets quality standards.

**QA Owner**: QALead  
**Test Owner**: QualityEngineer / Manual QA Team  
**Baseline Coverage**: 36.59% (automated), this checklist covers gaps  
**Last Updated**: 2026-06-05

---

## Tier 1: Core Functionality Testing (Pre-Release Gate)

### 1.1 Backend Service Startup & Health

- [ ] **Service starts without errors**
  ```bash
  systemctl status digital-signage.service
  systemctl restart digital-signage.service
  ```
  - Verify service enters `active (running)` state
  - Check logs: `journalctl -u digital-signage.service -n 50`
  - No error entries in logs

- [ ] **Health endpoint responds**
  ```bash
  curl http://localhost:3001/health
  ```
  - Expected: `{"status":"ok"}` 
  - Status code: 200

- [ ] **Database initializes**
  - Check database file exists: `ls -la /var/www/digital-signage-app/backend/data/signage.db`
  - Check for schema tables: `sqlite3 data/signage.db ".tables"`
  - Verify no corruption errors in logs

### 1.2 Frontend Service & Web UI

- [ ] **Frontend nginx starts**
  ```bash
  docker-compose logs frontend
  ```
  - No startup errors
  - Port 80 is listening

- [ ] **Web UI loads in browser**
  - Navigate to `http://localhost/`
  - Page loads without 404 errors
  - All static assets load (CSS, JS, images)
  - No CORS errors in browser console
  - No mixed content warnings

- [ ] **Admin login works**
  - Username: `admin` (or configured)
  - Password: (set in .env)
  - ⚠️ **SECURITY NOTE**: If still using default password 'admin', document change before production

### 1.3 API Response Validation

- [ ] **GET /health** → 200 OK
- [ ] **GET /playlists** → 200 OK (returns playlist list)
- [ ] **GET /screens** → 200 OK (returns screen list)
- [ ] **GET /media** → 200 OK (returns media files)
- [ ] **POST /media** → Accepts file upload
- [ ] **Error handling**: Send bad request → verify 400/422 response with error message

---

## Tier 2: User Workflow Testing (Critical Paths)

### 2.1 Admin UI Navigation

- [ ] **Dashboard loads**
  - Sidebar menu visible
  - Main content area renders
  - No JavaScript errors in console

- [ ] **Playlists page**
  - Click "Playlists" menu item
  - Page loads with list (if playlists exist)
  - Add Playlist button clickable
  - Can see playlist details

- [ ] **Screens page**
  - Click "Screens" menu item
  - Can see registered screens (if any)
  - Add Screen button available
  - Screen list shows status/tokens

- [ ] **Media library**
  - Click "Media" menu item
  - Media upload form visible
  - Can see uploaded files
  - Delete functionality works

### 2.2 Create & Configure Playlist

- [ ] **Create new playlist**
  - Fill form: name, description
  - Submit successfully
  - Redirected to playlist edit page
  - Playlist appears in list

- [ ] **Add media to playlist**
  - Upload test video (MP4, < 50MB)
  - Video upload progress shows
  - Upload completes without error
  - Video appears in media library

- [ ] **Add media to playlist sequence**
  - In playlist editor, drag media into sequence
  - Set duration: 10 seconds
  - Save changes successfully
  - Changes persist on reload

- [ ] **Playlist scheduling**
  - Set start time and end time
  - Set loop/repeat behavior
  - Save configuration
  - Verify settings saved on reload

### 2.3 Register & Configure Screen

- [ ] **Create new screen**
  - Click "Add Screen"
  - Generate screen token/QR code
  - Screen appears in list with unique token
  - Token is readable

- [ ] **Assign playlist to screen**
  - Select screen from list
  - Assign playlist to screen
  - Save configuration
  - Assignment persists

- [ ] **Screen status**
  - Verify "last seen" timestamp updates if screen is active
  - Check screen-specific logs

---

## Tier 3: Media Processing & Playback

### 3.1 Video File Support

Test each format with sample videos:

- [ ] **MP4 (H.264, 1920x1080, 30fps)**
  - Upload succeeds
  - Preview/thumbnail generates
  - No FFmpeg errors in logs
  - Backend processes within 30 seconds

- [ ] **MKV (VP9/H.265)**
  - Upload succeeds
  - FFmpeg transcode occurs (if needed)
  - Check performance: transcode time < 5 minutes for 2-hour video

- [ ] **MOV (ProRes, Apple format)**
  - Upload accepted
  - Transcode to web-safe format
  - No data loss or corruption

- [ ] **Invalid/unsupported format**
  - Attempt upload of unsupported format (.exe, .txt)
  - Error message displayed to user
  - Server rejects gracefully
  - No crash or file corruption

### 3.2 Large File Handling

- [ ] **Large file upload (>500MB)**
  - Upload doesn't timeout
  - Progress indicator works
  - Disk space check before upload (no disk full errors)
  - File integrity verified post-upload

- [ ] **Media on low-spec hardware**
  - Transfer video to Raspberry Pi or NUC
  - Verify no memory leaks during processing
  - Monitor CPU: should stay <50% during transcode
  - Monitor disk: should not fill unexpectedly

---

## Tier 4: Kiosk Mode & Hardware Deployment

### 4.1 Kiosk Fullscreen Playback

**Prerequisites**: Deployed on Raspberry Pi or Intel NUC

- [ ] **Launch kiosk mode**
  ```bash
  chromium-browser \
    --kiosk \
    --noerrdialogs \
    --disable-infobars \
    --no-first-run \
    "http://localhost/playlists/<PLAYLIST_ID>/play?screen=<SCREEN_TOKEN>"
  ```
  - Browser launches in fullscreen
  - URL bar hidden
  - Controls hidden

- [ ] **Playlist auto-play**
  - Playlist starts without user interaction
  - First media item plays immediately
  - No blank screens or loading delays

- [ ] **Media playback quality**
  - Video plays smoothly without stuttering
  - Audio/video sync maintained
  - Resolution displayed correctly (1920x1080 or configured)
  - No visual artifacts or glitching

- [ ] **Playlist rotation**
  - First media plays to end
  - Automatically transitions to next media
  - Transition is seamless (<2 second gap)
  - Correct duration displayed for each item

- [ ] **Mouse cursor hidden**
  ```bash
  unclutter -idle 0 &
  ```
  - Cursor disappears automatically
  - Does not interfere with playback
  - Persists across playlist rotation

- [ ] **Error recovery**
  - If media file missing: graceful error message
  - If FFmpeg transcode fails: skip to next media
  - Playlist continues playing despite errors
  - No hard crash to desktop

### 4.2 Network & Connectivity

- [ ] **Network disconnect during playback**
  - Disconnect ethernet/WiFi
  - Currently playing media continues (buffered)
  - Next media fails to load gracefully
  - Reconnect: resume playback when connection restored

- [ ] **Slow network (throttled)**
  - Test with 2Mbps link
  - Playback buffers but doesn't crash
  - Verify no memory buildup from repeated buffering

- [ ] **API unreachable**
  - Stop backend service
  - Screen displays error gracefully
  - No endless retry loops consuming CPU
  - Restart backend: screen recovers

### 4.3 Hardware Performance (Raspberry Pi 4)

- [ ] **CPU usage during playback**
  ```bash
  top -b -n 1 | grep -i "digital-signage\|chromium"
  ```
  - Backend CPU: < 30%
  - Frontend (chromium): < 40%
  - Combined: < 60%

- [ ] **Memory usage**
  ```bash
  free -h
  ```
  - Backend process: < 150MB
  - Chromium: < 200MB
  - No memory leak over 1 hour of playback

- [ ] **Disk space**
  - Check available disk: `df -h`
  - After 1-week uptime: disk doesn't fill up
  - Logs are rotating properly

- [ ] **Temperature**
  - Monitor thermal: `vcgencmd measure_temp` (RPi)
  - During 4-hour playback: < 70°C
  - No thermal throttling observed

---

## Tier 5: Data Persistence & Backup

### 5.1 Database Persistence

- [ ] **Data survives restart**
  - Add playlist and media before restart
  - Restart service: `systemctl restart digital-signage.service`
  - Data still present after restart
  - No data corruption

- [ ] **Volume mount integrity**
  - Verify data volume mounted: `docker volume ls`
  - Check data directory: `ls -la data/`
  - Database file size increasing (not shrinking unexpectedly)

### 5.2 Backup & Restore

- [ ] **Backup script runs successfully**
  ```bash
  bash scripts/backup-db.sh
  ls -lh /var/backups/signage/
  ```
  - Backup file created
  - File is readable (not corrupted)
  - Size is reasonable (> 0 bytes, < 500MB for default data)

- [ ] **Restore from backup**
  - Backup existing database
  - Delete current database
  - Restore from backup: `sqlite3 signage.db < backup.sql`
  - Data restored correctly
  - Application still runs

- [ ] **Cron backup job**
  ```bash
  sudo crontab -l
  ```
  - Backup job exists and is enabled
  - Verify automated backup ran: check `/var/backups/signage/`

---

## Tier 6: Security Baseline

### 6.1 Authentication

- [ ] **Default credentials changed**
  - ⚠️ CRITICAL: Verify admin password is NOT 'admin'
  - Check .env: `ADMIN_PASSWORD` != 'admin'
  - JWT_SECRET is set and strong (32+ characters)

- [ ] **Login validation**
  - Attempt login with wrong password → denied with error message
  - Attempt login with non-existent user → denied
  - Successful login sets session/JWT token

- [ ] **Session management**
  - Login and receive auth token
  - Use token in Authorization header: `Authorization: Bearer <token>`
  - Invalid/expired token → 401 Unauthorized
  - Logout clears session

### 6.2 API Security

- [ ] **CORS headers**
  - API allows requests from configured origin only
  - Requests from unauthorized origin → blocked
  - Check response header: `Access-Control-Allow-Origin`

- [ ] **Rate limiting**
  - Send 100 requests in 1 second to /media
  - After threshold, requests return 429 Too Many Requests
  - Rate limit reset works after cooldown period

- [ ] **Input validation**
  - POST /playlists with empty name → rejected with 400
  - POST /media with oversized file → rejected
  - SQL injection attempt in playlist name → sanitized/rejected

---

## Tier 7: Release Gate Checklist

**Before approving release to production, verify ALL of the following:**

- [ ] **Automated tests pass**
  - Backend: `npm test` → all tests passing
  - Frontend: `npm run test:e2e` → all E2E tests passing
  - Code coverage: ≥ 70% target met

- [ ] **Manual testing completed**
  - Core functionality (Tier 1) ✓ all items
  - User workflows (Tier 2) ✓ all items
  - Media processing (Tier 3) ✓ critical formats
  - Kiosk deployment (Tier 4) ✓ on target hardware
  - Data integrity (Tier 5) ✓ backup/restore tested
  - Security baseline (Tier 6) ✓ no critical issues

- [ ] **No known P0/P1 bugs**
  - Crashes on startup: None
  - Data loss scenarios: None
  - Security vulnerabilities: None
  - Documented P2/P3 issues with workarounds: OK

- [ ] **Performance validated**
  - Page load time: < 3 seconds
  - Playlist transition: < 2 seconds
  - API response: < 500ms (p95)
  - Kiosk playback smooth: no stuttering

- [ ] **Deployment validated**
  - Docker images build successfully
  - Services start without errors
  - Health checks pass
  - Data persists across restart

- [ ] **Documentation updated**
  - CHANGELOG reflects user-facing changes
  - README updated if needed
  - DEPLOYMENT.md is current

- [ ] **Code review approved**
  - At least one engineering review completed
  - No unresolved comments
  - Style/standards pass

---

## Reporting & Escalation

### Test Result Documentation

After each test cycle, document:
1. **Tester name & date**
2. **Environment**: (RPi 4, NUC, staging server, etc.)
3. **Test results**: Pass/Fail for each checklist item
4. **Issues found**: List any bugs or concerns with:
   - Description
   - Steps to reproduce
   - Severity (P0/P1/P2/P3)
   - Screenshot/video if applicable

### Escalation Path

| Severity | Action | Owner |
|----------|--------|-------|
| **P0** (Crash, data loss, security) | Block release, escalate to CTO | QALead |
| **P1** (Feature broken, major regression) | Review with engineering lead | QALead |
| **P2** (Partial feature issue, workaround exists) | Document for next release | QualityEngineer |
| **P3** (Minor cosmetic, nice-to-have fix) | Track in backlog | QualityEngineer |

---

## Kiosk-Specific Troubleshooting

### Issue: Blank screen on startup
- Check: Service running? `systemctl status digital-signage.service`
- Check: Frontend accessible? `curl http://localhost/`
- Solution: Restart both services, check logs

### Issue: Video stuttering/glitching
- Check: Network bandwidth available
- Check: Disk I/O not maxed: `iostat`
- Solution: Reduce video bitrate, check CPU usage

### Issue: Playlist doesn't loop
- Check: Loop/repeat setting in playlist config
- Check: Database persisted setting: `sqlite3 data/signage.db "SELECT loop_enabled FROM playlists WHERE id='...';"`
- Solution: Re-save playlist configuration

### Issue: Mouse cursor visible
- Check: unclutter running? `pgrep unclutter`
- Solution: `killall unclutter && unclutter -idle 0 &`

### Issue: Storage filling up
- Check: Logs rotating? `ls -la /var/log/digital-signage*`
- Check: Backups accumulating? `du -sh /var/backups/signage/`
- Solution: Implement log rotation, cleanup old backups

---

## Version & Change History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-06-05 | Initial checklist created, baseline coverage 36.59% |

**Next Review**: After test coverage reaches 70%
