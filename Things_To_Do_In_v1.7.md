# Things To Do In v1.7 — Security Hardening & Infrastructure

**Theme:** *The Shield — Harden the platform for production deployment*
**Priority:** P2 — Medium
**Depends on:** v1.5 (all features complete)
**Unlocks:** v2.0 (production launch)

---

## Why This Version Matters

The platform has all features built (v1.2–v1.6), but it's running on development infrastructure — no SSL, no reverse proxy, no rate limiting, secrets in plain text, no backups. This version makes CRVAP **production-grade** and **secure** before the final v2.0 launch.

---

## Nginx Reverse Proxy

### 1. Nginx Configuration

- [ ] Add `nginx` service to `docker-compose.yml`:
  ```yaml
  nginx:
    image: nginx:1.25-alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/conf.d/:/etc/nginx/conf.d/:ro
      - ./certbot/conf:/etc/letsencrypt:ro
      - ./certbot/www:/var/www/certbot:ro
      - ./frontend/dist:/usr/share/nginx/html:ro
    depends_on:
      - backend
  ```
- [ ] Create `nginx/conf.d/default.conf`:
  - Proxy `/api/` to `backend:8000`
  - Serve frontend static files from `/usr/share/nginx/html`
  - WebSocket proxy for future real-time features
  - Gzip compression for JSON and static assets
  - Cache headers for GeoJSON responses (5 min cache)
  - Cache headers for map tiles

### 2. SSL / TLS with Let's Encrypt

- [ ] Add Certbot service to `docker-compose.yml` for auto-renewal:
  ```yaml
  certbot:
    image: certbot/certbot
    volumes:
      - ./certbot/conf:/etc/letsencrypt
      - ./certbot/www:/var/www/certbot
    entrypoint: "/bin/sh -c 'trap exit TERM; while :; do certbot renew; sleep 12h & wait $${!}; done;'"
  ```
- [ ] Nginx config:
  - Listen on 443 with `ssl` and `http2`
  - TLS 1.2 and 1.3 only (disable older protocols)
  - Strong cipher suite
  - HSTS header: `Strict-Transport-Security: max-age=31536000; includeSubDomains`
- [ ] HTTP → HTTPS redirect (port 80 → 443)
- [ ] Create `scripts/init-ssl.sh` for first-time certificate generation
- [ ] Document the SSL setup process in README

### 3. Rate Limiting

- [ ] Nginx rate limiting configuration:
  ```nginx
  limit_req_zone $binary_remote_addr zone=api:10m rate=60r/m;
  limit_req_zone $binary_remote_addr zone=auth:10m rate=10r/m;
  ```
  - `/api/v1/auth/*` endpoints: 10 requests/minute per IP
  - All other `/api/*` endpoints: 60 requests/minute per IP
  - Return `429 Too Many Requests` when exceeded
- [ ] Burst allowance: `burst=10 nodelay` for API, `burst=3` for auth
- [ ] Log rate-limited requests for monitoring

---

## Token Security

### 4. Move JWT to Memory-Only Storage

- [ ] **Frontend change:** Remove `localStorage` usage for access_token
- [ ] Store access_token in React state (memory only):
  - Use a ref or module-level variable in the auth context
  - Token is lost on page refresh (by design)
- [ ] **Refresh token:** Keep in `httpOnly` cookie (not localStorage):
  - Backend sets `Set-Cookie: refresh_token=...; HttpOnly; Secure; SameSite=Strict; Path=/api/v1/auth/refresh`
  - Frontend never reads the refresh token directly
  - Axios automatically sends the cookie on refresh requests
- [ ] **On page load:**
  - Attempt silent refresh via cookie → get new access_token
  - If refresh fails → redirect to login
  - Show loading spinner during token restoration
- [ ] Update backend `/api/v1/auth/login` to set refresh token as httpOnly cookie
- [ ] Update backend `/api/v1/auth/refresh` to read refresh token from cookie

---

## Container Security

### 5. Non-Root Containers

- [ ] **Backend Dockerfile:** Add non-root user:
  ```dockerfile
  RUN addgroup --system app && adduser --system --ingroup app app
  USER app
  ```
- [ ] **Frontend Dockerfile:** Run as non-root:
  ```dockerfile
  RUN addgroup -S app && adduser -S app -G app
  USER app
  ```
- [ ] Verify file permissions are correct for non-root execution
- [ ] Test that entrypoint.sh works with non-root user (may need to adjust data directory ownership)

### 6. Docker Secrets

- [ ] Migrate sensitive environment variables from `docker-compose.yml` to Docker secrets:
  - `JWT_SECRET_KEY`
  - `FIRST_SUPERADMIN_PASSWORD`
  - `POSTGRES_PASSWORD`
- [ ] Create secret files in `secrets/` directory (gitignored):
  ```
  secrets/jwt_secret.txt
  secrets/superadmin_password.txt
  secrets/db_password.txt
  ```
- [ ] Update `docker-compose.yml`:
  ```yaml
  secrets:
    jwt_secret:
      file: ./secrets/jwt_secret.txt
  services:
    backend:
      secrets:
        - jwt_secret
  ```
- [ ] Update backend `config.py` to read from `/run/secrets/` when available, fallback to env vars for development
- [ ] Add `secrets/` to `.gitignore`
- [ ] Add `secrets/*.example` files with placeholder values

---

## Security Headers

### 7. HTTP Security Headers via Nginx

- [ ] Add security headers to Nginx config:
  ```nginx
  add_header X-Frame-Options "SAMEORIGIN" always;
  add_header X-Content-Type-Options "nosniff" always;
  add_header X-XSS-Protection "1; mode=block" always;
  add_header Referrer-Policy "strict-origin-when-cross-origin" always;
  add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' fonts.googleapis.com; font-src 'self' fonts.gstatic.com; img-src 'self' data: *.tile.openstreetmap.org; connect-src 'self'" always;
  add_header Permissions-Policy "geolocation=(), camera=(), microphone=()" always;
  ```
- [ ] Test headers with Mozilla Observatory or securityheaders.com

---

## Automated Backups

### 8. Database Backup System

- [ ] Create `scripts/backup.sh`:
  ```bash
  #!/bin/bash
  TIMESTAMP=$(date +%Y%m%d_%H%M%S)
  BACKUP_DIR=/backups
  pg_dump -h db -U postgres climatedb | gzip > $BACKUP_DIR/climatedb_$TIMESTAMP.sql.gz
  # Retain last 30 days
  find $BACKUP_DIR -name "*.sql.gz" -mtime +30 -delete
  ```
- [ ] Add backup volume to `docker-compose.yml`:
  ```yaml
  volumes:
    - ./backups:/backups
  ```
- [ ] Option A: Cron job inside a backup container
- [ ] Option B: Host-level cron calling `docker exec`
- [ ] Add `make backup` and `make restore` targets to Makefile
- [ ] Document backup/restore procedure in README

### 9. Backup Encryption (Optional)

- [ ] Encrypt backup files with GPG or openssl before storage
- [ ] Store encryption key securely (Docker secret or env var)
- [ ] `make restore` handles decryption automatically

---

## CORS Hardening

### 10. Strict CORS Policy

- [ ] Update `CORS_ORIGINS` to production domain only (no wildcards)
- [ ] Remove `localhost` origins in production config
- [ ] Create separate `.env.production` with production CORS settings
- [ ] Validate CORS_ORIGINS format on startup

---

## Frontend Build for Production

### 11. Production Build Pipeline

- [ ] Add production build stage to frontend Dockerfile:
  ```dockerfile
  FROM node:20-alpine AS build
  WORKDIR /app
  COPY package*.json ./
  RUN npm ci
  COPY . .
  RUN npm run build

  FROM nginx:1.25-alpine
  COPY --from=build /app/dist /usr/share/nginx/html
  ```
- [ ] Nginx serves the built static files (no Node server in production)
- [ ] Environment variables injected at build time via Vite's `import.meta.env`
- [ ] Create `.env.production` for frontend with production API URL
- [ ] Update `docker-compose.yml` with production profile:
  ```yaml
  # docker compose --profile production up
  ```

---

## Testing

- [ ] Test: HTTPS works with valid certificate
- [ ] Test: HTTP requests redirect to HTTPS
- [ ] Test: Rate limiting blocks excessive requests (return 429)
- [ ] Test: JWT access_token is not in localStorage (check via browser devtools)
- [ ] Test: Refresh token is httpOnly cookie (not accessible via JS)
- [ ] Test: Containers run as non-root user
- [ ] Test: Security headers present (X-Frame-Options, CSP, etc.)
- [ ] Test: Backup creates valid .sql.gz file
- [ ] Test: Restore from backup produces working database
- [ ] Test: Production frontend build serves correctly via Nginx

---

## Acceptance Criteria

1. All traffic flows through Nginx with valid SSL certificate (TLS 1.2+).
2. HTTP requests to port 80 redirect to HTTPS on port 443.
3. Auth endpoints are rate-limited to 10 req/min; API to 60 req/min.
4. JWT access_token exists only in JavaScript memory; refresh token is an httpOnly cookie.
5. All containers run as non-root users.
6. Sensitive credentials are stored as Docker secrets, not plain-text env vars.
7. Daily automated backups are created and retained for 30 days.
8. Security headers pass Mozilla Observatory scan with B+ or higher.
9. Frontend is served as a static production build via Nginx (no dev server).

---

## Estimated Scope

| Area | Tasks | Complexity |
|------|-------|-----------|
| Nginx (proxy + SSL + rate limiting) | 3 items | Medium |
| Token security | 1 item | Medium |
| Container security | 2 items | Low |
| Security headers | 1 item | Low |
| Backups | 2 items | Low-Medium |
| CORS + production build | 2 items | Low-Medium |
| Testing | 10 tests | Medium |
| **Total** | **21 items** | **Medium** |

**After v1.7:** The platform is production-hardened — secure transport, rate limiting, proper token management, non-root containers, secrets management, and automated backups. Ready for final polish in v2.0.
