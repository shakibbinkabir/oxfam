# Bangladesh Climate Risk Assessment Platform (CRVAP)

A web-based geospatial decision-support system for exploring, simulating, and understanding climate risk across Bangladesh's administrative hierarchy. Built for Oxfam in Bangladesh under the Climate Justice and Natural Resource Rights (CJNRR) programme.

## Features

- **Interactive Choropleth Map** — 5-class color-coded risk visualization across 5,160 unions
- **CVI Calculation Engine** — 3-stage pipeline: normalisation, aggregation, vulnerability scoring
- **What-If Simulation** — Modify indicators and instantly see CRI impact without persisting data
- **67 Climate Indicators** — Hazard, Exposure, Sensitivity, Adaptive Capacity, Environmental
- **Bilingual UI** — Full English and Bangla support with Noto Sans Bengali font
- **Role-Based Access Control** — Superadmin, Admin, and User roles
- **Export** — CSV, PDF reports, and Shapefile (GIS) format
- **Audit Trail** — Complete logging of all data changes
- **Async Processing** — Celery + Redis for batch uploads exceeding 500 rows
- **Real-Time Updates** — WebSocket notifications for score changes

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌──────────────┐
│   Browser    │────▶│    Nginx     │────▶│   FastAPI    │
│  React 19   │◀────│  (SSL/Rate)  │◀────│  (Backend)   │
│  Leaflet    │     │              │     │              │
└─────────────┘     └──────────────┘     └──┬───────────┘
                                            │
                    ┌──────────────┐     ┌───▼──────────┐
                    │    Redis     │◀───▶│  PostgreSQL  │
                    │  (Cache/MQ)  │     │  + PostGIS   │
                    └──────┬───────┘     └──────────────┘
                           │
                    ┌──────▼───────┐
                    │   Celery     │
                    │  (Workers)   │
                    └──────────────┘
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Backend** | Python 3.11+ / FastAPI (async ASGI) |
| **Frontend** | React 19 + Vite 7 + Tailwind CSS 4 |
| **Database** | PostgreSQL 16 + PostGIS 3.4 |
| **Map Engine** | Leaflet + OpenStreetMap / CARTO tiles |
| **Task Queue** | Celery + Redis 7 |
| **Reverse Proxy** | Nginx 1.25 (SSL, rate limiting, caching) |
| **Auth** | JWT (HS256) with httpOnly refresh cookies |
| **i18n** | i18next (English + Bangla) |
| **CI/CD** | GitHub Actions |
| **Container** | Docker 24 + Docker Compose |

## Quick Start

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running

### One-Command Setup

```bash
docker compose up --build
```

Or use Make:

```bash
make setup      # Build + start (auto-seeds everything)
make nuke       # Full destroy-and-rebuild from scratch
```

The backend auto-handles on first start:
1. Waits for PostgreSQL + PostGIS
2. Runs database migrations (11 versions)
3. Downloads Bangladesh GeoJSON boundaries from OCHA HDX
4. Imports 5,777 admin boundaries with geometry
5. Seeds 67 climate indicators from Excel
6. Creates superadmin account

### Access Points

| Service | URL |
|---------|-----|
| **Frontend** | http://localhost:5173 |
| **API Docs (Swagger)** | http://localhost:8000/docs |
| **Nginx (production)** | http://localhost |

### Default Login

- **Email**: `admin@example.com`
- **Password**: `admin123456`

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql+asyncpg://postgres:postgres@localhost:5432/climatedb` |
| `JWT_SECRET_KEY` | JWT signing secret (change in production!) | `change-me-in-production` |
| `REDIS_URL` | Redis connection string | `redis://localhost:6379/0` |
| `CORS_ORIGINS` | Allowed CORS origins (comma-separated) | `http://localhost:5173` |
| `ENVIRONMENT` | Runtime environment | `development` |
| `FIRST_SUPERADMIN_EMAIL` | Initial admin email | `admin@example.com` |
| `FIRST_SUPERADMIN_PASSWORD` | Initial admin password | `admin123456` |

## API Endpoints

Full interactive documentation at `/docs` (Swagger UI).

### Core Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/auth/login` | Authenticate, get JWT tokens |
| GET | `/api/v1/geo/boundaries` | GeoJSON boundaries by zoom + bbox |
| GET | `/api/v1/scores/map/geojson` | Choropleth GeoJSON with scores |
| POST | `/api/v1/simulate/` | Run what-if simulation |
| GET | `/api/v1/indicators/values` | List indicator values |
| POST | `/api/v1/batch-upload/` | Async batch upload (Celery) |
| GET | `/api/v1/batch-upload/{id}/status` | Batch job progress |
| GET | `/api/v1/export/csv` | Export data as CSV |
| GET | `/api/v1/export/pdf` | Export area report as PDF |
| WS | `/api/v1/ws` | WebSocket for real-time updates |

## RBAC Roles

| Feature | Admin | User | Unauthenticated |
|---------|-------|------|-----------------|
| View Dashboard & Map | Yes | Yes | No |
| Run Simulation | Yes | Yes | No |
| Export CSV/PDF | Yes | Yes | No |
| Export Shapefile | Yes | No | No |
| Create/Edit Data | Yes | No | No |
| Batch Upload | Yes | No | No |
| Manage Users | Superadmin | No | No |

## Production Deployment

### 1. Configure Secrets

```bash
mkdir -p secrets
openssl rand -hex 32 > secrets/jwt_secret.txt
openssl rand -hex 16 > secrets/db_password.txt
echo "YourSecureAdminPassword" > secrets/superadmin_password.txt
```

### 2. SSL Certificate

```bash
make ssl DOMAIN=your-domain.com EMAIL=admin@your-domain.com
```

### 3. Deploy

```bash
# Update CORS_ORIGINS in docker-compose.prod.yml
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

### Backup & Restore

```bash
make backup                                    # Create timestamped backup
make restore FILE=backups/climatedb_DATE.sql.gz # Restore from backup
```

## Make Commands

| Command | Description |
|---------|-------------|
| `make setup` | Build + start (auto-seeds everything) |
| `make nuke` | Destroy everything and rebuild |
| `make dev` | Start in foreground (attached) |
| `make test` | Run backend tests |
| `make backup` | Create database backup |
| `make restore FILE=...` | Restore from backup |
| `make prod` | Start production stack |
| `make ssl DOMAIN=...` | Setup SSL certificates |

## Project Structure

```
├── backend/
│   ├── app/
│   │   ├── api/            # FastAPI route handlers (12 modules)
│   │   ├── models/         # SQLAlchemy ORM models (12 tables)
│   │   ├── schemas/        # Pydantic validation schemas
│   │   ├── services/       # Business logic (CVI engine, audit)
│   │   ├── tasks/          # Celery async tasks
│   │   ├── scripts/        # Data import & seed scripts
│   │   ├── celery_app.py   # Celery configuration
│   │   └── main.py         # FastAPI app entry point
│   ├── alembic/            # Database migrations (11 versions)
│   ├── tests/              # pytest test suite
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── api/            # Axios API clients
│   │   ├── components/     # React components
│   │   ├── contexts/       # Auth & Map contexts
│   │   ├── hooks/          # Custom hooks
│   │   └── i18n/           # Translations (en, bn)
│   └── Dockerfile
├── nginx/                  # Reverse proxy configs
├── scripts/                # Backup, restore, SSL scripts
├── .github/workflows/      # CI/CD pipelines
├── docker-compose.yml      # Development stack
├── docker-compose.prod.yml # Production overrides
└── Makefile                # Development commands
```

## CVI Calculation Methodology

Based on the IPCC AR5 risk framework:

1. **Normalisation**: Min-max normalisation to [0, 1] against global reference values
2. **Aggregation**: Arithmetic mean of normalised sub-indicators per dimension
3. **Vulnerability**: `(Exposure + Sensitivity + (1 - Adaptive_Capacity)) / 3`
4. **CRI**: `(Hazard + Vulnerability) / 2`

CRI values near 1.0 indicate extremely high climate risk.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development guidelines.

## License

Proprietary — Oxfam in Bangladesh. Reproduction requires written consent.
