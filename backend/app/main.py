from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.database import close_db, init_db
from app.errors import (
  ConflictError,
  DuplicateError,
  NotFoundError,
  ValidationError,
)
from app.models.response import ApiResponse
from app.routers import (
  analytics,
  assets,
  dashboard,
  emotions,
  preferences,
  projections,
  screenshots,
  tags,
  trades,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
  """Initialize the database on startup, close it on shutdown."""
  await init_db()
  yield
  await close_db()


app = FastAPI(title="Kiroku", lifespan=lifespan)

# Single-user app: only the local Vite dev server may call the API.
app.add_middleware(
  CORSMiddleware,
  allow_origins=["http://localhost:5173", "http://kiroku:5173"],
  allow_methods=["*"],
  allow_headers=["*"],
)


def _error_response(status_code: int, message: str) -> JSONResponse:
  """Wrap an error in the standard { data, error } envelope."""
  return JSONResponse(
    status_code=status_code, content=ApiResponse(error=message).model_dump()
  )


@app.exception_handler(NotFoundError)
async def not_found_handler(
  request: Request, exc: NotFoundError
) -> JSONResponse:
  return _error_response(404, str(exc))


@app.exception_handler(DuplicateError)
async def duplicate_handler(
  request: Request, exc: DuplicateError
) -> JSONResponse:
  return _error_response(409, str(exc))


@app.exception_handler(ConflictError)
async def conflict_handler(
  request: Request, exc: ConflictError
) -> JSONResponse:
  return _error_response(409, str(exc))


@app.exception_handler(ValidationError)
async def validation_error_handler(
  request: Request, exc: ValidationError
) -> JSONResponse:
  return _error_response(400, str(exc))


@app.exception_handler(RequestValidationError)
async def validation_handler(
  request: Request, exc: RequestValidationError
) -> JSONResponse:
  # Surface the first validation error in the standard envelope.
  first = exc.errors()[0]
  location = ".".join(str(part) for part in first["loc"] if part != "body")
  message = f"{location}: {first['msg']}" if location else first["msg"]
  return _error_response(422, message)


app.include_router(assets.router)
app.include_router(tags.router)
app.include_router(emotions.router)
app.include_router(trades.router)
app.include_router(screenshots.router)
app.include_router(preferences.router)
app.include_router(dashboard.router)
app.include_router(analytics.router)
app.include_router(projections.router)


@app.get("/api/health")
async def health() -> ApiResponse[dict[str, str]]:
  return ApiResponse(data={"status": "ok"})
