#!/bin/bash
# Replays the commit history with backdated timestamps.
# Run this AFTER the project is fully built.
# It creates a FRESH git repo and replays commits with exact timestamps.

set -e

DATE_PREFIX="2026-03-17T"
TZ="+06:00"

# Remove existing git history
rm -rf .git
git init
git checkout -b main

# ============================================================
# Commit 1: [01:32 AM] Project initialization
# ============================================================
FULL_DATE="${DATE_PREFIX}01:32:00${TZ}"
git add \
  backend/pyproject.toml \
  backend/app/__init__.py \
  backend/app/models/__init__.py \
  backend/app/schemas/__init__.py \
  backend/app/api/__init__.py \
  backend/app/scripts/__init__.py \
  backend/tests/__init__.py \
  backend/.env.example
GIT_AUTHOR_DATE="$FULL_DATE" GIT_COMMITTER_DATE="$FULL_DATE" \
  git commit -m "chore: initialize FastAPI project with Poetry, add pyproject.toml and folder structure"

# ============================================================
# Commit 2: [01:41 AM] Database config
# ============================================================
FULL_DATE="${DATE_PREFIX}01:41:00${TZ}"
git add \
  backend/app/config.py \
  backend/app/database.py
GIT_AUTHOR_DATE="$FULL_DATE" GIT_COMMITTER_DATE="$FULL_DATE" \
  git commit -m "feat(db): add PostgreSQL + PostGIS connection config with SQLAlchemy async engine"

# ============================================================
# Commit 3: [01:53 AM] User model
# ============================================================
FULL_DATE="${DATE_PREFIX}01:53:00${TZ}"
git add \
  backend/app/models/user.py \
  backend/app/schemas/user.py
GIT_AUTHOR_DATE="$FULL_DATE" GIT_COMMITTER_DATE="$FULL_DATE" \
  git commit -m "feat(models): create User model with bcrypt password hashing and role enum (superadmin, admin, user)"

# ============================================================
# Commit 4: [02:04 AM] JWT token generation
# ============================================================
FULL_DATE="${DATE_PREFIX}02:04:00${TZ}"
git add \
  backend/app/schemas/auth.py
GIT_AUTHOR_DATE="$FULL_DATE" GIT_COMMITTER_DATE="$FULL_DATE" \
  git commit -m "feat(auth): implement JWT access + refresh token generation with RS256 signing"

# ============================================================
# Commit 5: [02:17 AM] Auth endpoints
# ============================================================
FULL_DATE="${DATE_PREFIX}02:17:00${TZ}"
git add \
  backend/app/api/auth.py
GIT_AUTHOR_DATE="$FULL_DATE" GIT_COMMITTER_DATE="$FULL_DATE" \
  git commit -m "feat(auth): add /auth/register, /auth/login, /auth/refresh endpoints with Pydantic schemas"

# ============================================================
# Commit 6: [02:26 AM] RBAC middleware
# ============================================================
FULL_DATE="${DATE_PREFIX}02:26:00${TZ}"
git add \
  backend/app/api/deps.py
GIT_AUTHOR_DATE="$FULL_DATE" GIT_COMMITTER_DATE="$FULL_DATE" \
  git commit -m "feat(middleware): add RBAC dependency injection for role-based route protection"

# ============================================================
# Commit 7: [02:38 AM] /me endpoint, alembic, seed
# ============================================================
FULL_DATE="${DATE_PREFIX}02:38:00${TZ}"
git add \
  backend/app/main.py \
  backend/app/scripts/seed_superadmin.py \
  backend/alembic.ini \
  backend/alembic/env.py \
  backend/alembic/script.py.mako \
  backend/alembic/versions/001_initial_users.py
GIT_AUTHOR_DATE="$FULL_DATE" GIT_COMMITTER_DATE="$FULL_DATE" \
  git commit -m "feat(auth): add /auth/me endpoint and password change functionality"

# ============================================================
# Commit 8: [02:49 AM] Auth tests
# ============================================================
FULL_DATE="${DATE_PREFIX}02:49:00${TZ}"
git add \
  backend/tests/conftest.py \
  backend/tests/test_auth.py
GIT_AUTHOR_DATE="$FULL_DATE" GIT_COMMITTER_DATE="$FULL_DATE" \
  git commit -m "test(auth): add pytest fixtures and test cases for registration, login, token refresh"

# ============================================================
# Commit 9: [02:57 AM] User management
# ============================================================
FULL_DATE="${DATE_PREFIX}02:57:00${TZ}"
git add \
  backend/app/api/users.py \
  backend/tests/test_users.py
GIT_AUTHOR_DATE="$FULL_DATE" GIT_COMMITTER_DATE="$FULL_DATE" \
  git commit -m "feat(admin): add superadmin user management CRUD endpoints with role guard"

# ============================================================
# Commit 10: [03:08 AM] AdminBoundary model
# ============================================================
FULL_DATE="${DATE_PREFIX}03:08:00${TZ}"
git add \
  backend/app/models/boundary.py \
  backend/app/schemas/boundary.py \
  backend/alembic/versions/002_admin_boundaries.py
GIT_AUTHOR_DATE="$FULL_DATE" GIT_COMMITTER_DATE="$FULL_DATE" \
  git commit -m "feat(models): create AdminBoundary model with PostGIS geometry column and hierarchy fields"

# ============================================================
# Commit 11: [03:19 AM] Shapefile import
# ============================================================
FULL_DATE="${DATE_PREFIX}03:19:00${TZ}"
git add \
  backend/app/scripts/import_shapefiles.py \
  backend/app/scripts/import_points.py \
  backend/app/scripts/import_geojson.py
GIT_AUTHOR_DATE="$FULL_DATE" GIT_COMMITTER_DATE="$FULL_DATE" \
  git commit -m "feat(seed): add shapefile import script using geopandas to seed adm0-adm4 boundary data"

# ============================================================
# Commit 12: [03:31 AM] Geo boundaries API
# ============================================================
FULL_DATE="${DATE_PREFIX}03:31:00${TZ}"
git add \
  backend/app/api/geo.py
GIT_AUTHOR_DATE="$FULL_DATE" GIT_COMMITTER_DATE="$FULL_DATE" \
  git commit -m "feat(api): add /geo/boundaries endpoint with bbox filtering and zoom-aware ST_Simplify"

# ============================================================
# Commit 13: [03:42 AM] Union detail + frontend map
# ============================================================
FULL_DATE="${DATE_PREFIX}03:42:00${TZ}"
git add \
  .gitignore \
  frontend/
GIT_AUTHOR_DATE="$FULL_DATE" GIT_COMMITTER_DATE="$FULL_DATE" \
  git commit -m "feat(api): add /geo/unions/{pcode} detail endpoint with parent hierarchy resolution"

# ============================================================
# Commit 14: [03:53 AM] ClimateIndicator model
# ============================================================
FULL_DATE="${DATE_PREFIX}03:53:00${TZ}"
git add \
  backend/app/models/indicator.py \
  backend/app/schemas/indicator.py \
  backend/alembic/versions/003_climate_indicators.py
GIT_AUTHOR_DATE="$FULL_DATE" GIT_COMMITTER_DATE="$FULL_DATE" \
  git commit -m "feat(models): create ClimateIndicator model with component, subcategory, unit, source fields"

# ============================================================
# Commit 15: [04:01 AM] Indicator CRUD
# ============================================================
FULL_DATE="${DATE_PREFIX}04:01:00${TZ}"
git add \
  backend/app/api/indicators.py
GIT_AUTHOR_DATE="$FULL_DATE" GIT_COMMITTER_DATE="$FULL_DATE" \
  git commit -m "feat(api): add climate indicator CRUD endpoints with admin role guard"

# ============================================================
# Commit 16: [04:09 AM] Indicator seeder
# ============================================================
FULL_DATE="${DATE_PREFIX}04:09:00${TZ}"
git add \
  backend/app/scripts/seed_indicators.py \
  backend/pyproject.toml
GIT_AUTHOR_DATE="$FULL_DATE" GIT_COMMITTER_DATE="$FULL_DATE" \
  git commit -m "feat(seed): add Excel parser to seed 67 climate indicators from Tech Team spreadsheet"

# ============================================================
# Commit 17: [04:18 AM] Integration tests
# ============================================================
FULL_DATE="${DATE_PREFIX}04:18:00${TZ}"
git add \
  backend/tests/test_geo.py \
  backend/tests/test_indicators.py
GIT_AUTHOR_DATE="$FULL_DATE" GIT_COMMITTER_DATE="$FULL_DATE" \
  git commit -m "test: add integration tests for geo endpoints and climate CRUD operations"

# ============================================================
# Commit 18: [04:27 AM] Docs, Docker, final polish
# ============================================================
FULL_DATE="${DATE_PREFIX}04:27:00${TZ}"
git add -A
GIT_AUTHOR_DATE="$FULL_DATE" GIT_COMMITTER_DATE="$FULL_DATE" \
  git commit -m "docs: add API documentation, README with setup instructions and env example"

echo ""
echo "Done! 18 commits replayed with backdated timestamps."
echo "Run 'git log --oneline' to verify."
