.PHONY: dev dev-backend dev-frontend install test lint

## Start backend and frontend concurrently.
## Ctrl+C stops both processes.
dev:
	@trap 'kill 0' EXIT; \
	(cd backend && uv run uvicorn app.main:app --reload --port 8000) & \
	(cd frontend && pnpm install --silent && exec pnpm dev)

dev-backend:
	cd backend && uv run uvicorn app.main:app --reload --port 8000

dev-frontend:
	cd frontend && pnpm dev

install:
	cd backend && uv sync
	cd frontend && pnpm install

test:
	cd backend && uv run pytest
	cd frontend && pnpm test

lint:
	cd backend && uv run ruff check .
	cd frontend && pnpm lint
	cd frontend && pnpm typecheck
