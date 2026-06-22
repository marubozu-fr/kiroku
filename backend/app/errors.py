class NotFoundError(Exception):
  """Raised when a requested resource does not exist."""


class DuplicateError(Exception):
  """Raised when a resource violates a uniqueness constraint."""


class ConflictError(Exception):
  """Raised when an operation conflicts with the current resource state."""


class ValidationError(Exception):
  """Raised when a request payload is malformed (e.g. invalid file upload)."""


class BackupError(Exception):
  """Raised when a backup or restore operation fails at the OS/disk level."""
