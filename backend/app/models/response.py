from typing import Generic, Optional, TypeVar

from pydantic import BaseModel

T = TypeVar("T")


class ApiResponse(BaseModel, Generic[T]):
  """Standard API envelope: every response carries `data` or `error`."""

  data: Optional[T] = None
  error: Optional[str] = None
