# Bangladesh Climate Risk Assessment Platform

Interactive geospatial dashboard for visualizing all 5,160 unions of Bangladesh with associated climate vulnerability indicators.

## Tech Stack

- **Backend**: FastAPI + PostgreSQL/PostGIS + SQLAlchemy 2.0 (async)
- **Frontend**: React 18 + Vite + Tailwind CSS + Leaflet
- **Auth**: JWT (HS256) with access/refresh tokens, RBAC (superadmin/admin/user)
- **Map**: Leaflet + OpenStreetMap + geoBoundaries polygon data
- **Indicators**: 67 climate indicators across 4 components (Hazard, Socioeconomic, Environmental, Infrastructural)

## Quick Start (Docker)

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running

### One-command setup

```bash
docker compose up --build
```

Or use Make:

```bash
make setup      # first-time setup (idempotent)
make nuke       # full destroy-and-rebuild from scratch
```

The backend container automatically handles the entire setup on startup:
1. Waits for PostgreSQL + PostGIS to be ready
2. Runs database migrations
3. Creates the superadmin account
4. Downloads Bangladesh admin boundary GeoJSON files from OCHA HDX (if not cached)
5. Imports 5,777 admin boundaries (1 country + 8 divisions + 64 districts + 544 upazilas + 5,160 unions)
6. Imports polygon geometry for all boundaries
7. Seeds 67 climate indicators from the Excel spreadsheet

All steps are **idempotent** — re-running skips already-completed work.

### Access

| Service | URL |
|---------|-----|
| **Frontend Dashboard** | http://localhost:5173 |
| **Backend API Docs** | http://localhost:8000/docs |

### Default Login

- **Email**: `admin@example.com`
- **Password**: `admin123456`

## Manual Setup (without Docker)

### Prerequisites

- Python 3.11+
- PostgreSQL 16 with PostGIS 3.4
- Node.js 20+

### Backend

```bash
cd backend
cp .env.example .env    # Edit with your database credentials
pip install poetry
poetry install
alembic upgrade head
uvicorn app.main:app --reload
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Data Import

```bash
# 1. Import admin boundary attributes from shapefiles
cd backend
python -m app.scripts.import_shapefiles --data-dir ../data/shapefiles

# 2. Import centroid coordinates
python -m app.scripts.import_points --data-dir ../data/shapefiles

# 3. Import polygon geometry from GeoJSON
python -m app.scripts.import_geojson --data-dir ../data/geojson

# 4. Seed climate indicators
python -m app.scripts.seed_indicators --file "../Tech Team_Climate Risk_Calculation.xlsx"
```

## GIS Data Sources

| Source | Description | Format |
|--------|-------------|--------|
| **BBS Shapefiles** | Admin boundary attributes (names, pcodes, hierarchy) | .dbf from .shp bundle |
| **geoBoundaries (HDX)** | Polygon geometry for ADM0-ADM4 | Simplified GeoJSON |
| **BBS Points** | Centroid coordinates for 5,160 unions | .dbf with POINT_X/POINT_Y |

The `make download-geodata` command automatically downloads simplified GeoJSON boundary files from [OCHA Humanitarian Data Exchange](https://data.humdata.org/dataset/cod-ab-bgd).

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql+asyncpg://postgres:postgres@localhost:5432/climatedb` |
| `JWT_SECRET_KEY` | Secret key for JWT signing | - |
| `JWT_ALGORITHM` | JWT algorithm | `HS256` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Access token TTL | `15` |
| `REFRESH_TOKEN_EXPIRE_DAYS` | Refresh token TTL | `7` |
| `FIRST_SUPERADMIN_EMAIL` | Initial superadmin email | `admin@example.com` |
| `FIRST_SUPERADMIN_PASSWORD` | Initial superadmin password | - |
| `SHAPEFILE_DIR` | Path to shapefile directory | `./data/shapefiles` |
| `CORS_ORIGINS` | Allowed CORS origins | `http://localhost:5173` |

## API Endpoints

### Authentication

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| POST | `/api/v1/auth/register` | Register new user | Public |
| POST | `/api/v1/auth/login` | Login, get JWT tokens | Public |
| POST | `/api/v1/auth/refresh` | Refresh access token | Authenticated |
| GET | `/api/v1/auth/me` | Current user profile | Authenticated |
| PUT | `/api/v1/auth/me/password` | Change password | Authenticated |

### User Management (Superadmin)

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/api/v1/users` | List all users | Superadmin |
| POST | `/api/v1/users` | Create user with role | Superadmin |
| PUT | `/api/v1/users/{id}` | Update user | Superadmin |
| DELETE | `/api/v1/users/{id}` | Soft delete user | Superadmin |

### GeoJSON / Map Data

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/api/v1/geo/boundaries` | GeoJSON by zoom + bbox | Authenticated |
| GET | `/api/v1/geo/divisions` | List 8 divisions | Authenticated |
| GET | `/api/v1/geo/districts` | List districts | Authenticated |
| GET | `/api/v1/geo/upazilas` | List upazilas | Authenticated |
| GET | `/api/v1/geo/unions` | List unions | Authenticated |
| GET | `/api/v1/geo/unions/{pcode}` | Union detail + hierarchy | Authenticated |
| GET | `/api/v1/geo/stats` | Feature counts per level | Authenticated |

### Climate Indicators

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/api/v1/indicators` | List indicators (filterable) | Authenticated |
| POST | `/api/v1/indicators` | Create indicator | Admin+ |
| GET | `/api/v1/indicators/{id}` | Indicator detail | Authenticated |
| PUT | `/api/v1/indicators/{id}` | Update indicator | Admin+ |
| DELETE | `/api/v1/indicators/{id}` | Delete indicator | Admin+ |
| GET | `/api/v1/indicators/export` | Export as CSV/JSON | Authenticated |

## RBAC Roles

| Role | Users | Indicators | Map | GIS Data |
|------|-------|-----------|-----|----------|
| **Superadmin** | Full CRUD | Full CRUD | Full | Full |
| **Admin** | None | Full CRUD | Full | Full |
| **User** | None | Read Only | Full | Full |

## Make Commands

| Command | Description |
|---------|-------------|
| `make setup` | Build + start (entrypoint auto-seeds everything) |
| `make nuke` | Full destroy-and-rebuild from scratch |
| `make dev` | Start all services (foreground/attached) |
| `make build` | Build and start all services (background) |
| `make migrate` | Run Alembic database migrations |
| `make download-geodata` | Download GeoJSON boundary files from HDX |
| `make seed` | Run all seed scripts |
| `make seed-geo` | Import shapefiles + points + GeoJSON geometry |
| `make seed-indicators` | Seed 67 climate indicators from Excel |
| `make test` | Run backend pytest suite |
| `make restart-frontend` | Restart frontend container |
| `make stop` | Stop all services |
| `make clean` | Stop and remove all data volumes |

## Running Tests

```bash
# With Docker
make test

# Manual
cd backend
python -m pytest tests/ -v
```

## Project Structure

```
├── backend/
│   ├── app/
│   │   ├── api/           # FastAPI route handlers
│   │   ├── models/        # SQLAlchemy models
│   │   ├── schemas/       # Pydantic validation schemas
│   │   └── scripts/       # Data import & seed scripts
│   ├── alembic/           # Database migrations
│   ├── tests/             # pytest test suite
│   ├── entrypoint.sh      # Auto-setup: migrations, geodata, seeding
│   ├── Dockerfile
│   └── pyproject.toml
├── frontend/
│   ├── src/
│   │   ├── api/           # Axios API clients
│   │   ├── components/    # React components
│   │   ├── contexts/      # Auth context
│   │   └── hooks/         # Custom hooks
│   ├── Dockerfile
│   └── package.json
├── data/
│   ├── shapefiles/        # BBS .dbf attribute files
│   └── geojson/           # Downloaded boundary polygons
├── docker-compose.yml
├── Makefile
└── README.md
```

## Screenshots

*Coming soon*
