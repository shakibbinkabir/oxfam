#!/bin/bash
set -e

echo "============================================"
echo "  Climate Risk Assessment Platform - Setup"
echo "============================================"

# ── 1. Wait for database ──────────────────────
echo ""
echo "[1/6] Waiting for database..."
until pg_isready -h db -U postgres -d climatedb -q 2>/dev/null; do
    echo "  Database not ready, retrying in 2s..."
    sleep 2
done

# Wait for PostGIS extensions to be available
until python -c "
import asyncio, asyncpg
async def check():
    conn = await asyncpg.connect('postgresql://postgres:postgres@db:5432/climatedb')
    await conn.execute('SELECT PostGIS_Version()')
    await conn.close()
asyncio.run(check())
" 2>/dev/null; do
    echo "  PostGIS initializing..."
    sleep 3
done
echo "  Database + PostGIS ready."

# ── 2. Run migrations ─────────────────────────
echo ""
echo "[2/6] Running database migrations..."
alembic upgrade head
echo "  Migrations complete."

# ── 3. Download geodata if missing ─────────────
echo ""
echo "[3/6] Checking geodata..."
if [ ! -f /data/geojson/adm4.geojson ]; then
    echo "  Downloading Bangladesh admin boundary GeoJSON files..."
    mkdir -p /data/geojson
    curl -sL -o /data/geojson/adm0.geojson "https://data.humdata.org/dataset/cod-ab-bgd/resource/c0b02351-3f87-4f20-bacc-13a421796d14/download/geoboundaries-bgd-adm0_simplified.geojson"
    curl -sL -o /data/geojson/adm1.geojson "https://data.humdata.org/dataset/cod-ab-bgd/resource/133ae77a-c998-4bd2-b47a-8f7aa669f35e/download/geoboundaries-bgd-adm1_simplified.geojson"
    curl -sL -o /data/geojson/adm2.geojson "https://data.humdata.org/dataset/cod-ab-bgd/resource/6c0dc233-85cb-4c2d-95f1-11e4e70007ed/download/geoboundaries-bgd-adm2_simplified.geojson"
    curl -sL -o /data/geojson/adm3.geojson "https://data.humdata.org/dataset/cod-ab-bgd/resource/a6ccb8ed-e520-437e-842f-7b0251fdd266/download/geoboundaries-bgd-adm3_simplified.geojson"
    curl -sL -o /data/geojson/adm4.geojson "https://data.humdata.org/dataset/cod-ab-bgd/resource/ec2ff4b7-ebf2-4d40-9c76-030970d81bc0/download/geoboundaries-bgd-adm4_simplified.geojson"
    echo "  GeoJSON files downloaded."
else
    echo "  GeoJSON files already present, skipping download."
fi

# ── 4. Import geographic data (idempotent) ─────
echo ""
echo "[4/6] Importing geographic data..."
BOUNDARY_COUNT=$(python -c "
import asyncio, asyncpg
async def count():
    conn = await asyncpg.connect('postgresql://postgres:postgres@db:5432/climatedb')
    row = await conn.fetchrow('SELECT COUNT(*) as cnt FROM admin_boundaries WHERE geom IS NOT NULL')
    await conn.close()
    print(row['cnt'])
asyncio.run(count())
" 2>/dev/null || echo "0")

if [ "$BOUNDARY_COUNT" -lt "5000" ]; then
    echo "  Importing admin boundary attributes from shapefiles..."
    python -m app.scripts.import_shapefiles --data-dir /data/shapefiles
    echo "  Importing point coordinates..."
    python -m app.scripts.import_points --data-dir /data/shapefiles
    echo "  Importing polygon geometry from GeoJSON..."
    python -m app.scripts.import_geojson --data-dir /data/geojson
    echo "  Geographic data imported."
else
    echo "  Geographic data already loaded ($BOUNDARY_COUNT boundaries with geometry), skipping."
fi

# ── 5. Seed climate indicators ─────────────────
echo ""
echo "[5/6] Seeding climate indicators..."
INDICATOR_COUNT=$(python -c "
import asyncio, asyncpg
async def count():
    conn = await asyncpg.connect('postgresql://postgres:postgres@db:5432/climatedb')
    row = await conn.fetchrow('SELECT COUNT(*) as cnt FROM climate_indicators')
    await conn.close()
    print(row['cnt'])
asyncio.run(count())
" 2>/dev/null || echo "0")

if [ "$INDICATOR_COUNT" -lt "60" ]; then
    python -m app.scripts.seed_indicators --file "/data/Tech Team_Climate Risk_Calculation.xlsx"
    echo "  Climate indicators seeded."
else
    echo "  Climate indicators already loaded ($INDICATOR_COUNT), skipping."
fi

# ── 6. Launch ──────────────────────────────────
echo ""
echo "[6/6] Starting application server..."
echo "============================================"
echo "  Setup complete!"
echo "  Frontend: http://localhost:5173"
echo "  Backend:  http://localhost:8000/docs"
echo "  Login:    admin@example.com / admin123456"
echo "============================================"
echo ""
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
