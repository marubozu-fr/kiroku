from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import close_db, init_db
from app.models.response import ApiResponse


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
  allow_origins=["http://localhost:5173"],
  allow_methods=["*"],
  allow_headers=["*"],
)


@app.get("/api/health")
async def health() -> ApiResponse[dict[str, str]]:
  return ApiResponse(data={"status": "ok"})
