# Contributing to CRVAP

Thank you for contributing to the Climate Risk & Vulnerability Assessment Platform.

## Development Setup

### Prerequisites

- Docker Desktop
- Node.js 20+ (for frontend development)
- Python 3.11+ (for backend development)

### Quick Start

```bash
# Clone and start all services
git clone <repository-url>
cd oxfam
docker compose up --build
```

### Backend Development

```bash
cd backend
pip install poetry
poetry install
# Run with auto-reload
uvicorn app.main:app --reload
```

### Frontend Development

```bash
cd frontend
npm install
npm run dev
```

## Code Guidelines

### Backend (Python/FastAPI)

- Follow PEP 8 style guide
- Use async/await for all database operations
- All new endpoints must include Pydantic request/response schemas
- Write tests for new API endpoints in `backend/tests/`
- Use the `envelope()` pattern for API responses
- All write operations must create audit log entries

### Frontend (React/JavaScript)

- Use functional components with hooks
- Use Tailwind CSS for styling (no custom CSS unless necessary)
- Support bilingual text via i18next (`t()` function)
- Use the `api/client.js` axios instance for all API calls
- Follow the existing component structure in `src/components/`

### Database Changes

- Create Alembic migrations for all schema changes
- Migrations must be reversible (include `downgrade()`)
- Name migrations sequentially: `010_description.py`, `011_description.py`, etc.

## Git Workflow

1. Create a feature branch from `master`
2. Make your changes
3. Run tests: `make test`
4. Run frontend lint: `cd frontend && npm run lint`
5. Create a pull request

## Running Tests

```bash
# Backend tests (requires running database)
make test

# Frontend lint
cd frontend && npm run lint
```

## Project Structure

See `README.md` for full project structure documentation.

## Adding New Indicators

1. Add indicator definition to the seed script or via the admin UI
2. Add the GIS attribute ID mapping
3. Create indicator reference entry with global min/max and direction
4. Update the CVI engine if the indicator belongs to a new dimension

## Deployment

See the deployment section in `README.md` for production deployment instructions.
