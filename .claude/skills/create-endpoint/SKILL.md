---
name: create-endpoint
description: Scaffold a new REST API endpoint with router, service, repository, models, and tests.
disable-model-invocation: true
---
Create a new API endpoint for: $ARGUMENTS

1. Identify the resource name and CRUD operations needed
2. Create or update the Pydantic models in `backend/app/models/<resource>.py`:
   - `<Resource>Create` (request body for POST)
   - `<Resource>Update` (request body for PUT)
   - `<Resource>Response` (response schema)
   - `<Resource>ListResponse` (list response with pagination if needed)
3. Create the repository in `backend/app/repositories/<resource>_repository.py`:
   - `get_all()`, `get_by_id()`, `create()`, `update()`, `delete()`
   - Use parameterized SQLite queries only
4. Create the service in `backend/app/services/<resource>_service.py`:
   - Business logic and validation beyond Pydantic
   - Call repository methods for data access
5. Create the router in `backend/app/routers/<resource>.py`:
   - RESTful routes: GET /, GET /{id}, POST /, PUT /{id}, DELETE /{id}
   - Standard response format: `{ "data": ..., "error": null }`
6. Register the router in `backend/app/main.py`
7. Create the database migration if new tables are needed
8. Write tests in `backend/tests/routers/test_<resource>.py`:
   - Test all CRUD operations
   - Test validation errors
   - Test not-found cases
9. Run tests: `cd backend && pytest tests/routers/test_<resource>.py -v`
10. Run linter: `cd backend && ruff check .`
