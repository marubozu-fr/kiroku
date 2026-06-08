class NotFoundError(Exception):
  """Raised when a requested resource does not exist."""


class DuplicateError(Exception):
  """Raised when a resource violates a uniqueness constraint."""
