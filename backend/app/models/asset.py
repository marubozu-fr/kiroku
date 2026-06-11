from enum import Enum
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class AssetCategory(str, Enum):
  """Allowed instrument categories."""

  forex = "Forex"
  crypto = "Crypto"
  stock = "Stock"
  etf = "ETF"
  indices = "Indices"


class AssetCreate(BaseModel):
  """Request body for creating an asset."""

  # Store the enum's string value so it maps directly to the TEXT column.
  model_config = ConfigDict(use_enum_values=True)

  name: str = Field(min_length=2, max_length=50)
  category: AssetCategory
  currency: Optional[str] = Field(default=None, max_length=10)


class AssetUpdate(BaseModel):
  """Request body for updating an asset. All fields optional."""

  model_config = ConfigDict(use_enum_values=True)

  name: Optional[str] = Field(default=None, min_length=2, max_length=50)
  category: Optional[AssetCategory] = None
  currency: Optional[str] = Field(default=None, max_length=10)
  is_active: Optional[bool] = None


class AssetResponse(BaseModel):
  """Response schema for an asset."""

  id: int
  name: str
  category: AssetCategory
  currency: Optional[str] = None
  is_active: bool
  created_at: Optional[str] = None
  updated_at: Optional[str] = None


class AssetTradeCount(BaseModel):
  """Response schema for an asset's trade reference count."""

  trade_count: int
