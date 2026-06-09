class NotFoundError(Exception):
  """Raised when a requested resource does not exist."""


class DuplicateError(Exception):
  """Raised when a resource violates a uniqueness constraint."""


class ValidationError(Exception):
  """Raised when a request payload is malformed (e.g. invalid file upload)."""
