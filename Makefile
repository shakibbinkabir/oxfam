.PHONY: setup dev test seed migrate stop clean

# Full setup: start services, run migrations, seed data
setup:
	docker compose up -d --build
	@echo "Waiting for database..."
	sleep 5
	docker compose exec backend alembic upgrade head
	docker compose exec backend python -m app.scripts.seed_superadmin
	@echo "Setup complete! Frontend: http://localhost:5173 | Backend: http://localhost:8000/docs"

# Start development servers
dev:
	docker compose up

# Run backend tests
test:
	docker compose exec backend python -m pytest tests/ -v

# Run all seed scripts
seed:
	docker compose exec backend python -m app.scripts.seed_superadmin
	docker compose exec backend python -m app.scripts.import_shapefiles --data-dir /data/shapefiles
	docker compose exec backend python -m app.scripts.seed_indicators --file /data/Tech\ Team_Climate\ Risk_Calculation.xlsx

# Run database migrations
migrate:
	docker compose exec backend alembic upgrade head

# Stop all services
stop:
	docker compose down

# Stop and remove volumes
clean:
	docker compose down -v
