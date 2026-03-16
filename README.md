# Bangladesh Climate Risk Assessment Platform

Interactive geospatial dashboard for visualizing all 5,160 unions of Bangladesh with associated climate vulnerability indicators.

## Tech Stack

- **Backend**: FastAPI + PostgreSQL/PostGIS + SQLAlchemy 2.0 (async)
- **Frontend**: React 18 + Vite + Tailwind CSS
- **Auth**: JWT (HS256) with access/refresh tokens
- **Map**: Leaflet + OpenStreetMap

## Quick Start

### Prerequisites

- Python 3.11+
- PostgreSQL 16 with PostGIS 3.4
- Node.js 20+

### Backend Setup

```bash
cd backend
cp .env.example .env  # Edit with your database credentials
pip install poetry
poetry install
alembic upgrade head
uvicorn app.main:app --reload
```

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql+asyncpg://postgres:postgres@localhost:5432/climatedb` |
| `JWT_SECRET_KEY` | Secret key for JWT signing | - |
| `JWT_ALGORITHM` | JWT algorithm | `HS256` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Access token TTL | `15` |
| `REFRESH_TOKEN_EXPIRE_DAYS` | Refresh token TTL | `7` |
| `FIRST_SUPERADMIN_EMAIL` | Initial superadmin email | `admin@example.com` |
| `FIRST_SUPERADMIN_PASSWORD` | Initial superadmin password | - |
| `CORS_ORIGINS` | Allowed CORS origins | `http://localhost:5173` |

### API Endpoints

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| POST | `/api/v1/auth/register` | Register new user | Public |
| POST | `/api/v1/auth/login` | Login | Public |
| POST | `/api/v1/auth/refresh` | Refresh token | Authenticated |
| GET | `/api/v1/auth/me` | Current user profile | Authenticated |
| PUT | `/api/v1/auth/me/password` | Change password | Authenticated |
| GET | `/api/v1/users` | List users | Superadmin |
| POST | `/api/v1/users` | Create user | Superadmin |
| PUT | `/api/v1/users/{id}` | Update user | Superadmin |
| DELETE | `/api/v1/users/{id}` | Delete user | Superadmin |

### Default Credentials

After first run, a superadmin account is created from environment variables:
- Email: `FIRST_SUPERADMIN_EMAIL`
- Password: `FIRST_SUPERADMIN_PASSWORD`

Access the API docs at: http://localhost:8000/docs
