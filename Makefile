.PHONY: setup dev test seed seed-geo seed-indicators migrate stop clean download-geodata nuke

# ========== ONE COMMAND TO RULE THEM ALL ==========
# Destroys everything and rebuilds from scratch
nuke: clean
	rm -rf pgdata/
	$(MAKE) setup

# Full setup: build, migrate, seed superadmin, download & import geodata, seed indicators
setup: build migrate seed-superadmin download-geodata seed-geo seed-indicators
	@echo ""
	@echo "Setup complete!"
	@echo "  Frontend: http://localhost:5173"
	@echo "  Backend:  http://localhost:8000/docs"
	@echo "  Login:    admin@example.com / admin123456"

# Build and start all services
build:
	docker compose up -d --build
	@echo "Waiting for database..."
	sleep 5

# Start development servers
dev:
	docker compose up

# Run database migrations
migrate:
	docker compose run --rm backend alembic upgrade head

# Seed superadmin user
seed-superadmin:
	docker compose exec backend python -m app.scripts.seed_superadmin

# Download geoBoundaries GeoJSON files from HDX
download-geodata:
	@mkdir -p data/geojson
	@echo "Downloading Bangladesh admin boundary GeoJSON files..."
	curl -sL -o data/geojson/adm0.geojson "https://data.humdata.org/dataset/cod-ab-bgd/resource/c0b02351-3f87-4f20-bacc-13a421796d14/download/geoboundaries-bgd-adm0_simplified.geojson"
	curl -sL -o data/geojson/adm1.geojson "https://data.humdata.org/dataset/cod-ab-bgd/resource/133ae77a-c998-4bd2-b47a-8f7aa669f35e/download/geoboundaries-bgd-adm1_simplified.geojson"
	curl -sL -o data/geojson/adm2.geojson "https://data.humdata.org/dataset/cod-ab-bgd/resource/6c0dc233-85cb-4c2d-95f1-11e4e70007ed/download/geoboundaries-bgd-adm2_simplified.geojson"
	curl -sL -o data/geojson/adm3.geojson "https://data.humdata.org/dataset/cod-ab-bgd/resource/a6ccb8ed-e520-437e-842f-7b0251fdd266/download/geoboundaries-bgd-adm3_simplified.geojson"
	curl -sL -o data/geojson/adm4.geojson "https://data.humdata.org/dataset/cod-ab-bgd/resource/ec2ff4b7-ebf2-4d40-9c76-030970d81bc0/download/geoboundaries-bgd-adm4_simplified.geojson"
	@echo "GeoJSON files downloaded to data/geojson/"

# Import all geodata (shapefiles for attributes + GeoJSON for geometry)
seed-geo:
	@echo "Importing admin boundary attributes..."
	docker compose exec backend python -m app.scripts.import_shapefiles --data-dir /data/shapefiles
	@echo "Importing point coordinates..."
	docker compose exec backend python -m app.scripts.import_points --data-dir /data/shapefiles
	@echo "Importing polygon geometry from GeoJSON..."
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

# Stop all services
stop:
	docker compose down

# Stop and remove volumes (full reset)
clean:
	docker compose down -v
	@echo "To also remove database data, run: rm -rf pgdata/"
