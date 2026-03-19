# Things To Do In v2.0 — Production Launch

**Theme:** *The Launch — Final polish, performance, CI/CD, and production readiness*
**Priority:** P3 — Polish
**Depends on:** v1.7 (security hardening complete)
**Milestone:** Production deployment to Oxfam Bangladesh

---

## Why This Version Matters

This is the **final milestone** — everything from v1.2 to v1.7 has been built, tested, and secured. v2.0 focuses on **performance optimisation, async processing, CI/CD, accessibility, real-time updates, and production deployment**. After this version, CRVAP is a complete, deployment-ready platform matching the PRD specification.

---

## Celery + Redis — Async Task Queue

### 1. Redis Service

- [ ] Add Redis to `docker-compose.yml`:
  ```yaml
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 3
  ```
- [ ] Add `redis` to backend dependencies: `celery[redis]`

### 2. Celery Worker Configuration

- [ ] Create `app/celery_app.py`:
  ```python
  from celery import Celery
  celery = Celery("crvap", broker="redis://redis:6379/0", backend="redis://redis:6379/1")
  ```
- [ ] Add Celery worker service to `docker-compose.yml`:
  ```yaml
  celery_worker:
    build: ./backend
    command: celery -A app.celery_app worker --loglevel=info
    depends_on:
      - redis
      - db
    volumes:
      - ./backend:/app
  ```
- [ ] Create `app/tasks/` directory for task definitions

### 3. Async Batch Upload Processing

- [ ] Refactor `POST /api/v1/indicators/values/bulk` to:
  - Accept file upload
  - Create a `batch_jobs` record (status: pending)
  - Queue Celery task for processing
  - Return immediately with `job_id`
- [ ] Create `batch_jobs` table via migration:
  ```
  id (UUID), filename (string), status (enum: pending, processing, completed, failed),
  total_rows (int), processed_rows (int), created_count (int), updated_count (int),
  error_count (int), errors (JSONB), submitted_by (FK users),
  started_at, completed_at, created_at
  ```
- [ ] `GET /api/v1/batch-upload/{job_id}/status` — Return job progress:
  ```json
  {
    "job_id": "...",
    "status": "processing",
    "progress": { "total": 5000, "processed": 2340, "percent": 46.8 },
    "results": null
  }
  ```
- [ ] Celery task updates `processed_rows` during execution (progress tracking)
- [ ] Frontend: Job status panel with progress bar and auto-refresh (poll every 2s)

### 4. Async Score Recomputation

- [ ] When bulk data is uploaded, queue a Celery task to recompute all affected scores
- [ ] `POST /api/v1/scores/recompute` triggers full recomputation as background task
- [ ] Return job_id for status tracking

---

## WebSocket Real-Time Updates

### 5. WebSocket Integration

- [ ] Add `websockets` dependency (FastAPI native support)
- [ ] Create WebSocket endpoint: `WS /api/v1/ws`
- [ ] Events to broadcast:
  - `score_updated`: When CVI scores are recomputed for a boundary
  - `data_imported`: When batch upload completes
  - `scenario_saved`: When a new scenario is saved
- [ ] Frontend: Connect WebSocket on dashboard load
- [ ] On `score_updated` event: re-fetch map scores, update KPI bar, refresh side panel if open
- [ ] Graceful degradation: if WebSocket disconnects, fall back to polling

---

## CI/CD Pipeline

### 6. GitHub Actions Workflow

- [ ] Create `.github/workflows/ci.yml`:
  ```yaml
  name: CI
  on: [push, pull_request]
  jobs:
    test-backend:
      runs-on: ubuntu-latest
      services:
        postgres:
          image: postgis/postgis:16-3.4
          env:
            POSTGRES_DB: test_climatedb
            POSTGRES_PASSWORD: test
          ports:
            - 5432:5432
      steps:
        - uses: actions/checkout@v4
        - uses: actions/setup-python@v5
          with:
            python-version: '3.11'
        - run: pip install poetry && poetry install
        - run: pytest --cov=app tests/

    test-frontend:
      runs-on: ubuntu-latest
      steps:
        - uses: actions/checkout@v4
        - uses: actions/setup-node@v4
          with:
            node-version: '20'
        - run: cd frontend && npm ci && npm run lint

    build:
      runs-on: ubuntu-latest
      needs: [test-backend, test-frontend]
      steps:
        - uses: actions/checkout@v4
        - run: docker compose build
  ```

### 7. Deployment Workflow

- [ ] Create `.github/workflows/deploy.yml`:
  - Triggered on push to `master` (or release tag)
  - Build Docker images
  - Push to container registry (Docker Hub / GitHub Container Registry)
  - SSH to production server and pull + restart services
  - Or: deploy to cloud provider (AWS ECS, DigitalOcean, etc.)
- [ ] Create deployment documentation with server requirements

---

## Performance Optimisation

### 8. GeoJSON Response Caching

- [ ] Cache GeoJSON responses in Redis with configurable TTL (default: 5 minutes)
- [ ] Cache key: `geojson:{level}:{indicator}:{bbox_hash}`
- [ ] Invalidate cache when indicator values are updated
- [ ] Add `Cache-Control` headers to GeoJSON responses
- [ ] Nginx caching layer as fallback (proxy_cache)

### 9. Database Query Optimisation

- [ ] Add database indexes for common query patterns:
  - Composite index on `indicator_values(boundary_pcode, indicator_id)`
  - Index on `computed_scores(boundary_pcode)`
  - Partial index on `indicator_values(is_deleted = false)`
- [ ] Use `EXPLAIN ANALYZE` to identify slow queries
- [ ] Add connection pooling configuration (SQLAlchemy pool_size, max_overflow)
- [ ] Consider materialized views for aggregated scores by admin level

### 10. Frontend Performance

- [ ] Code splitting with React.lazy() for route-level components:
  - MapPage, IndicatorsPage, UsersPage, etc. loaded on demand
- [ ] Lazy-load Leaflet/map libraries (largest bundle chunk)
- [ ] Image optimization and SVG icons (replace any large assets)
- [ ] Measure and target: Initial dashboard load under 3 seconds on 10 Mbps
- [ ] Bundle analysis with `vite-plugin-visualizer`
- [ ] Prefetch critical routes

---

## Accessibility (WCAG 2.1 AA)

### 11. Keyboard Navigation

- [ ] All interactive map controls keyboard-accessible:
  - Tab to indicator selector, legend, layer controls
  - Enter/Space to activate buttons
  - Arrow keys for map pan (Leaflet default)
- [ ] Tab order follows logical flow on all pages
- [ ] Focus indicators (outline) visible on all interactive elements
- [ ] Skip-to-content link on dashboard

### 12. Screen Reader Support

- [ ] Add `aria-label` attributes to:
  - Map container: "Climate risk choropleth map of Bangladesh"
  - Score bars: "Hazard score: 0.72 out of 1.0"
  - KPI cards: descriptive text for each metric
- [ ] `role` attributes on custom components (toolbar, tablist, etc.)
- [ ] `alt` text on all images and icons
- [ ] Live regions (`aria-live`) for dynamic score updates

### 13. Colour & Contrast

- [ ] Verify minimum contrast ratio 4.5:1 for all text (use axe or Lighthouse)
- [ ] Ensure choropleth colours are distinguishable for colour-blind users:
  - Add pattern fills (stripes, dots) in addition to colour
  - Or: offer a colour-blind-friendly palette option
- [ ] Test with colour blindness simulators (protanopia, deuteranopia)

---

## Responsiveness

### 14. Mobile / Tablet Layout

- [ ] **Responsive breakpoints:**
  - Desktop (≥1280px): Full layout as designed
  - Tablet (768px–1279px): Sidebar collapses to icons; panel overlays map
  - Mobile (<768px): Map full-screen; panel as full-screen drawer; bottom sheet for KPI
- [ ] Map controls repositioned for touch interaction
- [ ] Touch-friendly tooltip (tap instead of hover)
- [ ] Side panel becomes swipeable drawer on mobile
- [ ] Test on: Chrome mobile, Safari iOS, Samsung Internet

---

## Documentation & Handover

### 15. Technical Documentation

- [ ] Update `README.md` with:
  - Architecture diagram (services, data flow)
  - Complete API documentation link (Swagger)
  - Development setup guide (step-by-step)
  - Production deployment guide
  - Backup/restore procedures
  - Environment variable reference
- [ ] Create `CONTRIBUTING.md` with development guidelines
- [ ] Create `CHANGELOG.md` with version history (v1.0 → v2.0)

### 16. API Documentation

- [ ] Verify all endpoints have complete Swagger/OpenAPI documentation:
  - Request/response schemas
  - Example values
  - Authentication requirements
  - Error responses
- [ ] Add API versioning note (currently v1, future v2 path)

### 17. Sustainability Plan

- [ ] Document: How to add new indicators
- [ ] Document: How to update boundary data when BBS publishes new shapefiles
- [ ] Document: How to extend the CVI formula
- [ ] Document: How to add new export formats
- [ ] Document: Monitoring and alerting recommendations
- [ ] Knowledge transfer sessions plan for Oxfam IT team

---

## Final Quality Assurance

### 18. End-to-End Testing

- [ ] Test complete user journey — Admin:
  1. Login → Upload CSV → Verify on map → View side panel → Simulate → Export PDF → View audit log
- [ ] Test complete user journey — General User:
  1. Login → Browse map → Drill down → View scores → Run simulation → Export CSV
- [ ] Test complete user journey — Bangla User:
  1. Switch to Bangla → Navigate map → View area score → Understand breakdown
- [ ] Test edge cases:
  - Union with missing indicators (partial data)
  - Empty map (no data uploaded yet)
  - Large batch upload (>5,000 rows)
  - Concurrent simulations from multiple users
  - Session expiry during long form entry

### 19. Performance Testing

- [ ] Load test API endpoints with 50 concurrent users (k6 or locust)
- [ ] Verify dashboard loads under 3 seconds on 10 Mbps
- [ ] Verify map re-colours under 1 second after indicator switch
- [ ] Verify simulation returns results under 2 seconds
- [ ] Database performance with full dataset (8,181 unions × 40+ indicators)

### 20. Security Audit

- [ ] Run OWASP ZAP scan against production deployment
- [ ] Verify no sensitive data in client-side code (API keys, secrets)
- [ ] Check for dependency vulnerabilities: `pip audit`, `npm audit`
- [ ] Penetration test: attempt common attacks (XSS, CSRF, SQL injection, auth bypass)
- [ ] Review CORS, CSP, and security headers

---

## Production Deployment Checklist

### 21. Pre-Launch

- [ ] Domain name configured and DNS pointed to server
- [ ] SSL certificate issued and auto-renewal confirmed
- [ ] Production environment variables set (no dev defaults)
- [ ] JWT_SECRET_KEY is a strong random value (≥256 bits)
- [ ] Database passwords are strong and unique
- [ ] CORS_ORIGINS set to production domain only
- [ ] Backup system running and verified
- [ ] Monitoring/alerting configured (uptime, error rate, disk space)
- [ ] Log rotation configured for all services
- [ ] Seed data verified: all 67 indicators, 5,777 boundaries, superadmin account

### 22. Launch

- [ ] Deploy to production server
- [ ] Verify all services start correctly
- [ ] Run smoke tests on production
- [ ] Confirm SSL, security headers, rate limiting
- [ ] Create initial admin user accounts for Oxfam team
- [ ] Client walkthrough and sign-off

---

## Testing Summary

- [ ] Unit tests: ≥80% backend code coverage
- [ ] Integration tests: All API endpoints tested
- [ ] Frontend: Lint clean, no console errors
- [ ] E2E: 3 complete user journeys pass
- [ ] Performance: Load test benchmarks met
- [ ] Security: OWASP scan clean, npm/pip audit clean
- [ ] Accessibility: Lighthouse score ≥90 for accessibility
- [ ] Cross-browser: Chrome, Firefox, Edge, Safari tested

---

## Acceptance Criteria

1. Batch uploads >500 rows process asynchronously with real-time progress tracking.
2. WebSocket pushes score updates to connected clients when data changes.
3. CI pipeline runs tests on every push; deployment is automated on master merge.
4. Dashboard loads under 3 seconds on 10 Mbps connection.
5. All pages meet WCAG 2.1 AA accessibility standards.
6. Platform is fully functional at 1280x720 minimum; usable on tablet/mobile.
7. Complete technical documentation and sustainability plan delivered.
8. Production deployment passes security audit and performance benchmarks.
9. All four user personas (Admin, Analyst, Donor, Local Govt Officer) can complete their primary tasks without assistance.

---

## Estimated Scope

| Area | Tasks | Complexity |
|------|-------|-----------|
| Celery + Redis | 4 items | High |
| WebSocket | 1 item | Medium |
| CI/CD | 2 items | Medium |
| Performance | 3 items | Medium |
| Accessibility | 3 items | Medium |
| Responsiveness | 1 item | Medium |
| Documentation | 3 items | Low-Medium |
| QA & Testing | 3 items | High |
| Production deployment | 2 items | Medium |
| **Total** | **22 items** | **High** |

**After v2.0:** CRVAP is a complete, production-deployed, secure, performant, accessible, bilingual climate risk intelligence platform — fully matching the PRD specification and ready for handover to Oxfam in Bangladesh.

---

## Version Roadmap Summary

```
v1.1 ✅  Foundation — Auth, CRUD, Map, Batch Upload, Docker
v1.2     CVI Calculation Engine (the brain)
v1.3     Score-Based Map & Dashboard (the eyes)
v1.4     What-If Simulation Tool (the imagination)
v1.5     Data Wizard, Exports & Audit Trail (the completeness)
v1.6     Bilingual Support EN/BN (the voice)
v1.7     Security Hardening (the shield)
v2.0     Production Launch (the finish line)
```

```
Overall Progress:
v1.1 ████████████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  38%
v1.2 ░░░░░░░░░░░░░░░░░░░░██████░░░░░░░░░░░░░░░░░░░░░░░░  +10%  → 48%
v1.3 ░░░░░░░░░░░░░░░░░░░░░░░░░░██████░░░░░░░░░░░░░░░░░░  +10%  → 58%
v1.4 ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░█████░░░░░░░░░░░░░  +9%   → 67%
v1.5 ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░█████░░░░░░░░  +10%  → 77%
v1.6 ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░████░░░░  +7%   → 84%
v1.7 ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░██░░  +6%   → 90%
v2.0 ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░██  +10%  → 100%
```
