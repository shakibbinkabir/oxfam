# Changelog

All notable changes to CRVAP are documented in this file.

## [2.1.0] - 2026-03-20 — PRD Completion

### Added
- WebSocket broadcast on all data mutations (indicator create/update/delete/restore, risk index save, bulk upload)
- File preview table for CSV uploads before processing (column detection, first 10 rows)
- Per-area CSV export from detail side panel (replaces JSON export)
- Noto Sans Bengali web font import for consistent Bangla rendering
- New i18n keys for file preview, CSV export, and upload subtitles (EN + BN)

### Changed
- Detail side panel now renders full-width on mobile as a full-screen drawer
- Map view hides on mobile when detail panel is open (collapses per PRD spec)
- Bulk uploader shows data preview step with detected columns before upload
- Side panel export changed from JSON to CSV format per PRD requirement
- Frontend build adds Tailwind `lg:` breakpoints for responsive map/panel behavior

### Fixed
- WebSocket `broadcast_event()` was defined but never called from data mutation endpoints
- Mobile viewport had overlapping map and side panel instead of collapsing

## [2.0.0] - 2026-03-20 — Production Launch

### Added
- Celery + Redis async task queue for batch processing
- WebSocket endpoint for real-time score update notifications
- Batch job tracking with progress status API
- GitHub Actions CI/CD pipeline (test, lint, build, deploy)
- Database performance indexes for common query patterns
- Frontend code splitting with React.lazy() for faster initial load
- Skip-to-content link and keyboard navigation improvements (WCAG 2.1 AA)
- ARIA labels on map, KPI bar, detail panel, and simulation modal
- Reduced motion support for accessibility
- Focus-visible styles for keyboard users
- WebSocket client hook with auto-reconnect
- Batch upload job status polling UI
- CONTRIBUTING.md with development guidelines
- This CHANGELOG

### Changed
- Bulk upload endpoint now queues async Celery tasks (with sync fallback)
- Nginx configs updated with WebSocket proxy support
- Docker Compose includes Redis and Celery worker services
- Frontend components use lazy loading for route-level code splitting
- Improved responsive behavior on tablet and mobile

### Performance
- Added composite database indexes on indicator_values and computed_scores
- Partial index on non-deleted indicator values
- GeoJSON response caching via Nginx (5-minute TTL in production)
- Frontend bundle splitting reduces initial JS payload

## [1.7.0] — Security Hardening

### Added
- Docker secrets support for JWT, database, and superadmin passwords
- Production Docker Compose with SSL/TLS (Let's Encrypt)
- Non-root container execution
- CORS hardening (reject wildcards in production)
- Database backup and restore scripts
- SSL initialization script

## [1.6.0] — Bilingual Support

### Added
- Full English/Bangla UI with i18next
- Bilingual boundary names (name_en, name_bn)
- Language switcher in sidebar
- Bangla PDF export support

## [1.5.0] — Data Wizard, Exports & Audit Trail

### Added
- Multi-step Risk Index data entry wizard
- CSV, PDF, and Shapefile export endpoints
- Audit logging for all write operations
- Soft-delete with restore for indicator values

## [1.4.0] — What-If Simulation Tool

### Added
- Simulation modal with all 40+ indicator fields
- Custom weight sliders for CVI dimensions
- Side-by-side original vs simulated score comparison
- Save simulation as named scenario (admin)
- Dashed overlay on map for simulated boundaries

## [1.3.0] — Score-Based Map & Dashboard

### Added
- Choropleth map with 5-class color scale
- Score-based GeoJSON endpoint with aggregation
- KPI summary bar (highest risk, avg CRI, coverage)
- Detail side panel with CRI breakdown
- Indicator selector for switching map layers
- Drill-down navigation (Division > District > Upazila > Union)

## [1.2.0] — CVI Calculation Engine

### Added
- 3-stage CVI calculation pipeline
- Min-max normalisation against global reference values
- Component score aggregation (arithmetic mean)
- Vulnerability and CRI computation
- Calculation trace endpoint for transparency
- Indicator reference table with global min/max and direction

## [1.1.0] — Foundation

### Added
- FastAPI backend with async PostgreSQL/PostGIS
- JWT authentication with access/refresh tokens
- Role-based access control (superadmin, admin, user)
- Admin boundary management (5,777 boundaries)
- 67 climate indicator definitions
- Indicator value CRUD and bulk upload
- Interactive Leaflet map with GeoJSON boundaries
- Docker Compose development environment
- Automated setup via entrypoint script
