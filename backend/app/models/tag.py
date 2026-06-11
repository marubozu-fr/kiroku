from typing import Optional

from pydantic import BaseModel, Field


class TagCreate(BaseModel):
  """Request body for creating a tag."""

  name: str = Field(min_length=3, max_length=100)
  description: Optional[str] = Field(default=None, max_length=500)


class TagUpdate(BaseModel):
  """Request body for updating a tag. All fields optional."""

  name: Optional[str] = Field(default=None, min_length=3, max_length=100)
  description: Optional[str] = Field(default=None, max_length=500)
  is_active: Optional[bool] = None


class TagResponse(BaseModel):
  """Response schema for a tag."""

  id: int
  name: str
  description: Optional[str] = None
  is_active: bool
  created_at: Optional[str] = None
  updated_at: Optional[str] = None


class TagTradeCount(BaseModel):
  """Response schema for a tag's trade reference count."""

  trade_count: int
