.PHONY: setup dev test seed seed-geo seed-indicators migrate stop clean download-geodata nuke wait-db

# ========== ONE COMMAND TO RULE THEM ALL ==========
# Destroys everything and rebuilds from scratch
nuke:
	docker compose down -v
ifeq ($(OS),Windows_NT)
	@if exist pgdata ( rmdir /s /q pgdata )
else
	rm -rf pgdata/
endif
	docker compose up --build -d
	@echo Watching setup progress... (Ctrl+C to detach, containers keep running)
	docker compose logs -f backend

# Full setup: just build and start — the backend entrypoint handles
# migrations, geodata download, geo import, and indicator seeding automatically.
setup:
	docker compose up --build -d
	@echo Watching setup progress... (Ctrl+C to detach, containers keep running)
	docker compose logs -f backend

# Build and start all services
build:
	docker compose up -d --build

# Wait for DB to be fully ready (handles fresh pgdata init + PostGIS extension install)
wait-db:
	@echo Waiting for database to be fully ready...
	@docker compose exec db sh -c "while ! pg_isready -U postgres -d climatedb -q; do sleep 2; done"
	@docker compose exec db sh -c "until psql -U postgres -d climatedb -c 'SELECT PostGIS_Version()' > /dev/null 2>&1; do echo '  DB initializing...'; sleep 3; done"
	@echo Database is ready.

# Start development servers (attached mode)
dev:
	docker compose up

# Run database migrations
migrate:
	docker compose exec backend alembic upgrade head

# Seed superadmin user
seed-superadmin:
	docker compose exec backend python -m app.scripts.seed_superadmin

# Download geoBoundaries GeoJSON files from HDX
download-geodata:
ifeq ($(OS),Windows_NT)
	@if not exist data\geojson mkdir data\geojson
else
	@mkdir -p data/geojson
endif
	@echo Downloading Bangladesh admin boundary GeoJSON files...
	curl -sL -o data/geojson/adm0.geojson "https://data.humdata.org/dataset/cod-ab-bgd/resource/c0b02351-3f87-4f20-bacc-13a421796d14/download/geoboundaries-bgd-adm0_simplified.geojson"
	curl -sL -o data/geojson/adm1.geojson "https://data.humdata.org/dataset/cod-ab-bgd/resource/133ae77a-c998-4bd2-b47a-8f7aa669f35e/download/geoboundaries-bgd-adm1_simplified.geojson"
	curl -sL -o data/geojson/adm2.geojson "https://data.humdata.org/dataset/cod-ab-bgd/resource/6c0dc233-85cb-4c2d-95f1-11e4e70007ed/download/geoboundaries-bgd-adm2_simplified.geojson"
	curl -sL -o data/geojson/adm3.geojson "https://data.humdata.org/dataset/cod-ab-bgd/resource/a6ccb8ed-e520-437e-842f-7b0251fdd266/download/geoboundaries-bgd-adm3_simplified.geojson"
	curl -sL -o data/geojson/adm4.geojson "https://data.humdata.org/dataset/cod-ab-bgd/resource/ec2ff4b7-ebf2-4d40-9c76-030970d81bc0/download/geoboundaries-bgd-adm4_simplified.geojson"
	@echo GeoJSON files downloaded to data/geojson/

# Import all geodata (shapefiles for attributes + GeoJSON for geometry)
seed-geo:
	@echo Importing admin boundary attributes...
	docker compose exec backend python -m app.scripts.import_shapefiles --data-dir /data/shapefiles
	@echo Importing point coordinates...
	docker compose exec backend python -m app.scripts.import_points --data-dir /data/shapefiles
	@echo Importing polygon geometry from GeoJSON...
	docker compose exec backend python -m app.scripts.import_geojson --data-dir /data/geojson

# Seed climate indicators from Excel
seed-indicators:
	docker compose exec backend python -m app.scripts.seed_indicators --file "/data/Tech Team_Climate Risk_Calculation.xlsx"

# Run all seed scripts
seed: seed-superadmin seed-geo seed-indicators

# Run backend tests
test:
	docker compose exec backend python -m pytest tests/ -v

# Restart frontend (useful after code changes)
restart-frontend:
	docker compose restart frontend

# Restart backend (needed after migrations to pick up fresh DB)
restart-backend:
	docker compose restart backend
	@docker compose exec db sh -c "while ! pg_isready -U postgres -d climatedb -q; do sleep 1; done"

# Stop all services
stop:
	docker compose down

# Stop and remove volumes (full reset)
clean:
	docker compose down -v
