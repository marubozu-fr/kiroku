from enum import Enum
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator


class EmotionSeverity(str, Enum):
  """How an emotion tends to affect trading."""

  good = "Good"
  bad = "Bad"
  warning = "Warning"


class EmotionCategory(str, Enum):
  """Allowed emotion categories."""

  emotional_state = "Emotional State"
  mental_triggers = "Mental Triggers"
  focus_and_clarity = "Focus & Clarity"
  execution_confidence = "Execution Confidence"
  why_this_trade = "Why This Trade?"


class EmotionCreate(BaseModel):
  """Request body for creating an emotion."""

  # Store each enum's string value so it maps directly to the TEXT column.
  model_config = ConfigDict(use_enum_values=True)

  name: str = Field(min_length=3, max_length=100)
  description: Optional[str] = Field(default=None, max_length=500)
  severity: EmotionSeverity
  category: EmotionCategory


class EmotionUpdate(BaseModel):
  """Request body for updating an emotion. All fields optional."""

  model_config = ConfigDict(use_enum_values=True)

  name: Optional[str] = Field(default=None, min_length=3, max_length=100)
  description: Optional[str] = Field(default=None, max_length=500)
  severity: Optional[EmotionSeverity] = None
  category: Optional[EmotionCategory] = None


class EmotionResponse(BaseModel):
  """Response schema for an emotion."""

  id: int
  name: str
  description: Optional[str] = None
  severity: EmotionSeverity
  category: EmotionCategory
  created_at: Optional[str] = None
  updated_at: Optional[str] = None


class EmotionBulkCreate(BaseModel):
  """Request body for bulk-creating emotions (up to 42 items)."""

  emotions: list[EmotionCreate]

  @field_validator("emotions")
  @classmethod
  def at_least_one(cls, v: list[EmotionCreate]) -> list[EmotionCreate]:
    if not v:
      raise ValueError("At least one emotion is required")
    names = [e.name for e in v]
    seen: set[str] = set()
    duplicates: list[str] = []
    for name in names:
      if name in seen:
        duplicates.append(name)
      seen.add(name)
    if duplicates:
      raise ValueError(f"Duplicate names in batch: {', '.join(duplicates)}")
    return v


class EmotionTradeCount(BaseModel):
  """Response schema for an emotion's trade reference count."""

  trade_count: int
