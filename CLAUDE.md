# Kiroku (記録) — Trading Journal

## Project Overview
Kiroku is a local-first trading journal built with FastAPI (backend) and React + TypeScript (frontend).
It is designed for a single user running the app on their own machine.
Repository: `marubozu-fr/kiroku` — License: AGPL-3.0

## Tech Stack
- **Backend**: Python 3.12+, FastAPI, SQLite (via `aiosqlite` + `databases`), Pydantic
- **Frontend**: React 18+, TypeScript, Mantine UI, CSS Modules, TradingView Lightweight Charts
- **Desktop (optional)**: Tauri
- **Package managers**: `uv` (Python), `pnpm` (Node)

## Code Style — STRICT
- **Language**: All code, comments, commit messages, and documentation in English
- **Indentation**: 2 spaces everywhere (Python, TypeScript, JSON, YAML, CSS)
- **Python**: Follow PEP 8 except for 2-space indentation. Type hints on all functions.
- **TypeScript**: Strict mode enabled. No `any` types. Prefer `interface` over `type` for objects.
- **CSS**: CSS Modules only. No inline styles. No Tailwind. No styled-components.
- **Architecture**: API-First. Backend is a pure REST API. Frontend consumes the API. No server-side rendering.

## API Conventions
- RESTful endpoints: `GET /api/trades`, `POST /api/trades`, `PUT /api/trades/{id}`, `DELETE /api/trades/{id}`
- All responses follow: `{ "data": ..., "error": null }` or `{ "data": null, "error": "message" }`
- Snake_case for Python and API JSON fields. camelCase for TypeScript internal variables.
- Pydantic models for all request/response validation.

## i18n Conventions
- Every user-facing string must use `t('key')` via `useTranslation()` from `react-i18next`
- Key naming: dot-separated, nested in JSON — page-scoped (e.g., `journal.table.header.date`, `common.actions.save`)
- `common.*` for shared strings (actions, statuses, labels reused across pages)
- `<page>.*` for page-specific strings (e.g., `settings.*`, `journal.*`, `trade.*`)
- EN (`en.json`) is the source of truth — all 6 locale files must have identical key structure
- Supported languages: EN, FR, ES, IT, DE, PT
- Trading terms listed in `docs/I18N_GLOSSARY.md` stay in English in ALL languages
- Interpolation uses `{{variable}}` syntax: `t('trade.pnl_value', { value: pnl })`
- Language preference stored in `localStorage` key `kiroku-language`
- No backend changes for i18n — language is a frontend-only concern

## Project Structure
```
kiroku/
├── .claude/              # Claude Code agents, skills, hooks
├── backend/
│   ├── app/
│   │   ├── main.py       # FastAPI app entry point
│   │   ├── routers/      # API route handlers
│   │   ├── models/       # Pydantic models
│   │   ├── services/     # Business logic
│   │   ├── repositories/ # Database access layer
│   │   └── database.py   # SQLite connection
│   ├── tests/
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/   # React components
│   │   ├── pages/        # Page-level components
│   │   ├── hooks/        # Custom React hooks
│   │   ├── services/     # API client functions
│   │   ├── types/        # TypeScript interfaces
│   │   └── theme/        # Mantine theme overrides
│   ├── package.json
│   └── tsconfig.json
├── docs/                 # Design system, architecture decisions
├── CLAUDE.md
└── README.md
```

## Git Workflow
- Branch naming: `feature/<issue-number>-short-description`, `fix/<issue-number>-short-description`
- Commit messages: `feat(scope): description`, `fix(scope): description`, `docs(scope): description`
- Every change goes through a PR linked to a GitHub issue.
- Never commit directly to `main`.

## Commands
- **Backend**: `cd backend && uvicorn app.main:app --reload --port 8000`
- **Frontend**: `cd frontend && pnpm dev`
- **Tests backend**: `cd backend && pytest`
- **Tests frontend**: `cd frontend && pnpm test`
- **Lint backend**: `cd backend && ruff check .`
- **Lint frontend**: `cd frontend && pnpm lint`

## Behavioral Guidelines

### Think Before Coding
- State your assumptions explicitly before implementing. If uncertain, ask.
- If multiple interpretations exist, present them — don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

### Simplicity First
- Minimum code that solves the problem. Nothing speculative.
- No features beyond what was asked. No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- If you write 200 lines and it could be 50, rewrite it.

### Surgical Changes
- Touch only what you must. Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken. Match existing style.
- If you notice unrelated issues, mention them — don't fix them silently.
- Remove only imports/variables/functions that YOUR changes made unused.
- The test: every changed line should trace directly to the request.

### Goal-Driven Execution
- Transform tasks into verifiable goals with success criteria.
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- For multi-step tasks, state a brief plan with verification at each step.

## Project Rules
- NEVER add placeholder data or mock statistics. Only display real data from the database.
- NEVER skip error handling on API calls.
- ALWAYS write tests for new endpoints and critical business logic.
- ALWAYS check the design system (docs/DESIGN_SYSTEM.md) before creating UI components.
- ALWAYS search existing code patterns before implementing something new.