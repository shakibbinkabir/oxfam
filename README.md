# Bangladesh Climate Risk Assessment Platform

Interactive geospatial dashboard for visualizing all 5,160 unions of Bangladesh with associated climate vulnerability indicators.

## Tech Stack

- **Backend**: FastAPI + PostgreSQL/PostGIS + SQLAlchemy 2.0 (async)
- **Frontend**: React 18 + Vite + Tailwind CSS
- **Auth**: JWT (HS256) with access/refresh tokens
- **Map**: Leaflet + OpenStreetMap
- **Indicators**: 67 climate indicators across 4 components

## Quick Start (Docker)

```bash
# 1. Clone and configure
cp backend/.env.example backend/.env   # Edit with your values

# 2. Start all services
make setup

# 3. Copy shapefiles into ./data/shapefiles/

# 4. Seed geodata and indicators
make seed

# 5. Access
# Frontend: http://localhost:5173
# Backend API: http://localhost:8000/docs
```

## Manual Setup

### Prerequisites

- Python 3.11+
- PostgreSQL 16 with PostGIS 3.4
- Node.js 20+

### Backend

```bash
cd backend
cp .env.example .env
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

### Import GIS Data

```bash
cd backend
python -m app.scripts.import_shapefiles --data-dir ../data/shapefiles/
```

### Seed Climate Indicators

```bash
cd backend
python -m app.scripts.seed_indicators --file "../Tech Team_Climate Risk_Calculation.xlsx"
```

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

## Running Tests

```bash
# With Docker
make test

# Manual
cd backend
python -m pytest tests/ -v
```

## Make Commands

| Command | Description |
|---------|-------------|
| `make setup` | Build containers, run migrations, seed superadmin |
| `make dev` | Start all services |
| `make test` | Run backend tests |
| `make seed` | Run all seed scripts |
| `make migrate` | Run Alembic migrations |
| `make stop` | Stop all services |
| `make clean` | Stop and remove volumes |

## Default Credentials

After first run, a superadmin account is created from environment variables:
- Email: `FIRST_SUPERADMIN_EMAIL`
- Password: `FIRST_SUPERADMIN_PASSWORD`

## Screenshots

*Coming soon*
