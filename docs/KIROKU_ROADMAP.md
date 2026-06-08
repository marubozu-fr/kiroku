# Kiroku — Roadmap & GitHub Issues

## Architecture recap

```
kiroku/
├── backend/           # FastAPI, Python 3.12+, SQLite (aiosqlite + databases), Pydantic v2
│   ├── app/
│   │   ├── main.py
│   │   ├── routers/   # HTTP handlers, Pydantic validation
│   │   ├── models/    # Pydantic request/response schemas
│   │   ├── services/  # Business logic
│   │   ├── repositories/  # SQL queries (parameterized only)
│   │   └── database.py    # SQLite connection + init
│   └── tests/
├── frontend/          # React 18+, TypeScript strict, Mantine UI, CSS Modules
│   └── src/
│       ├── pages/     # Route-level components
│       ├── components/# Reusable UI pieces
│       ├── hooks/     # Custom React hooks
│       ├── services/  # API client (fetch wrappers)
│       ├── types/     # TypeScript interfaces
│       └── theme/     # Mantine overrides
└── docs/              # Design system, architecture
```

Key conventions: 2-space indent, English code, API-First, `{ "data": ..., "error": null }` response format, snake_case API / camelCase TS internals.

---

## Milestones overview

| # | Milestone | Scope | Depends on |
|---|-----------|-------|------------|
| M0 | Project bootstrap | Scaffold both apps, DB schema, tooling, CI | — |
| M1 | Reference data | Assets, tags, emotions CRUD (API + UI) | M0 |
| M2 | Trade journal | Trade CRUD, list, form, detail view | M1 |
| M3 | Dashboard | Key metrics, equity curve, monthly breakdown | M2 |
| M4 | Analytics | Filters, statistics engine, breakdowns | M2 |
| M5 | Projections | Forecasts, scenarios, real vs projected | M4 |
| M6 | Advanced | IBKR, MCP server, Tauri, data import | M2+ |

---

## M0 — Project bootstrap

Goal: both apps run locally, database is initialized, CI catches regressions.

### Issue #1 — Initialize backend project structure

```
Title: [M0] Initialize FastAPI backend project structure
Labels: backend, infrastructure, M0-bootstrap

## Description

Scaffold the FastAPI backend with the layered architecture defined in CLAUDE.md.

## Acceptance criteria

- [ ] `backend/` directory with the following structure:
  - `app/main.py` — FastAPI app with CORS (localhost only), lifespan handler for DB init
  - `app/database.py` — SQLite connection via `databases` library, `init_db()` function
  - `app/routers/` — empty `__init__.py`
  - `app/models/` — base response model (`ApiResponse`)
  - `app/services/` — empty `__init__.py`
  - `app/repositories/` — empty `__init__.py`
- [ ] `requirements.txt` with pinned versions: fastapi, uvicorn, databases[aiosqlite], pydantic
- [ ] `GET /api/health` returns `{ "data": { "status": "ok" }, "error": null }`
- [ ] `uvicorn app.main:app --reload --port 8000` starts successfully
- [ ] ruff configured for 2-space indentation, PEP 8

## Technical notes

- Single-user, no auth — no middleware needed
- CORS: allow `http://localhost:5173` only
- SQLite file: `data/kiroku.db` (created on first run, gitignored)
```

### Issue #2 — Initialize frontend project structure

```
Title: [M0] Initialize React + TypeScript frontend with Mantine
Labels: frontend, infrastructure, M0-bootstrap

## Description

Scaffold the React frontend with Vite, TypeScript strict mode, and Mantine UI dark theme.

## Acceptance criteria

- [ ] `frontend/` created with `pnpm create vite` (React + TypeScript template)
- [ ] Mantine UI v7 installed and configured:
  - Dark theme as default (per design system)
  - Color scheme toggle (dark/light)
  - JetBrains Mono loaded for financial numbers
- [ ] App shell with Mantine `AppShell`:
  - Collapsible sidebar (navbar) with placeholder nav links
  - Main content area with `maw={1400}` centered
- [ ] React Router v6 with placeholder pages: Dashboard, Journal, Analytics, Projections, Settings
- [ ] `src/services/api.ts` — base fetch wrapper with standard response handling
- [ ] `src/types/api.ts` — `ApiResponse<T>` interface
- [ ] `pnpm dev` starts on port 5173, proxies `/api` to `localhost:8000`
- [ ] ESLint + TypeScript strict mode configured
- [ ] CSS Modules confirmed working (one test component)

## Technical notes

- No Tailwind, no styled-components — CSS Modules only
- Mantine theme overrides in `src/theme/` per DESIGN_SYSTEM.md
- `tsconfig.json` with `strict: true`, path alias `@/` -> `src/`
```

### Issue #3 — Design and create SQLite database schema

```
Title: [M0] Design and create SQLite database schema
Labels: backend, database, M0-bootstrap

## Description

Design the complete SQLite schema for Kiroku. Single-user, no encryption,
relational model replacing TraderPro's JSON file storage.

## Schema

### assets
| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | autoincrement |
| name | TEXT NOT NULL | unique, e.g. "EURUSD" |
| category | TEXT NOT NULL | Forex, Crypto, Stock, ETF, Indices |
| currency | TEXT | quote currency, e.g. "USD" |
| is_active | BOOLEAN | default 1 |
| created_at | TEXT | ISO 8601 |
| updated_at | TEXT | ISO 8601 |

### tags
| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | autoincrement |
| name | TEXT NOT NULL | e.g. "Double Top", "Break of structure" |
| description | TEXT | |
| is_active | BOOLEAN | default 1 |
| created_at | TEXT | |
| updated_at | TEXT | |

### emotions
| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | autoincrement |
| name | TEXT NOT NULL | e.g. "Overconfident" |
| description | TEXT | |
| severity | TEXT NOT NULL | Good, Bad, Warning |
| category | TEXT NOT NULL | Emotional State, Mental Triggers, etc. |
| created_at | TEXT | |
| updated_at | TEXT | |

### trades
| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | autoincrement |
| asset_id | INTEGER FK | -> assets.id |
| status | TEXT NOT NULL | Open, Partial, Breakeven, Closed |
| direction | TEXT | Long, Short |
| stop_loss | REAL | |
| notes | TEXT | |
| missed_opportunity | BOOLEAN | default 0 |
| risk_per_trade | REAL | percentage of capital |
| avg_entry_price | REAL | calculated |
| avg_exit_price | REAL | calculated |
| risk | REAL | calculated (R units) |
| reward | REAL | calculated (R units) |
| performance_r | REAL | calculated |
| trade_date | TEXT | ISO 8601, date of first activity |
| created_at | TEXT | |
| updated_at | TEXT | |

### trade_activities
| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | autoincrement |
| trade_id | INTEGER FK | -> trades.id, ON DELETE CASCADE |
| type | TEXT NOT NULL | Buy, Sell |
| price | REAL NOT NULL | |
| quantity | REAL NOT NULL | lot size |
| date | TEXT NOT NULL | ISO 8601 |
| is_entry | BOOLEAN | default 0 |

### trade_tags (junction)
| Column | Type | Notes |
|--------|------|-------|
| trade_id | INTEGER FK | -> trades.id, ON DELETE CASCADE |
| tag_id | INTEGER FK | -> tags.id |
| PRIMARY KEY | (trade_id, tag_id) | |

### trade_emotions (junction)
| Column | Type | Notes |
|--------|------|-------|
| trade_id | INTEGER FK | -> trades.id, ON DELETE CASCADE |
| emotion_id | INTEGER FK | -> emotions.id |
| PRIMARY KEY | (trade_id, emotion_id) | |

### trade_screenshots
| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER PK | autoincrement |
| trade_id | INTEGER FK | -> trades.id, ON DELETE CASCADE |
| filename | TEXT NOT NULL | stored in data/screenshots/ |
| timeframe_unit | TEXT | M, H, D, W |
| timeframe_value | INTEGER | e.g. 15 for M15 |
| created_at | TEXT | |

## Acceptance criteria

- [ ] `backend/app/schema.sql` contains the full schema
- [ ] `database.py` reads and executes schema on first run (if tables don't exist)
- [ ] `data/` directory gitignored
- [ ] All foreign keys use ON DELETE CASCADE where appropriate
- [ ] Indexes on: `trades.asset_id`, `trades.trade_date`, `trades.status`

## Open questions

- `entry_timeframe` on trades (the timeframe the trader watches) — column on trades table or separate? Suggest adding two columns: `timeframe_unit TEXT` and `timeframe_value INTEGER` directly on the trades table.
```

### Issue #4 — Configure dev tooling and CI

```
Title: [M0] Configure dev tooling and GitHub Actions CI
Labels: infrastructure, M0-bootstrap

## Description

Set up linting, formatting, testing, and CI pipeline for both backend and frontend.

## Acceptance criteria

- [ ] Backend:
  - ruff (linter + formatter) configured: 2-space indent, line-length 120
  - pytest + pytest-asyncio + httpx configured
  - `pytest` runs and passes (with at least the health check test)
- [ ] Frontend:
  - ESLint with TypeScript strict rules
  - Vitest configured for unit tests
  - `pnpm test` runs and passes (with at least one smoke test)
- [ ] GitHub Actions workflow (`.github/workflows/ci.yml`):
  - Triggers on push to main and PRs
  - Backend job: install deps, ruff check, pytest
  - Frontend job: install deps, lint, type-check, vitest
- [ ] `.gitignore` updated for: data/, venv/, node_modules/, .env, __pycache__, dist/
```

---

## M1 — Reference data (settings)

Goal: CRUD for all "building block" entities. Settings page functional.

### Issue #5 — Assets CRUD API

```
Title: [M1] Assets CRUD API endpoints
Labels: backend, API, M1-reference-data

## Description

Implement full CRUD for trading assets (Forex pairs, stocks, crypto, etc.).
Follow the create-endpoint skill: router -> service -> repository -> models.

## Endpoints

- `GET /api/assets` — list all assets (optional `?active=true` filter)
- `GET /api/assets/{id}` — get single asset
- `POST /api/assets` — create asset
- `PUT /api/assets/{id}` — update asset
- `DELETE /api/assets/{id}` — soft delete (set is_active=false)

## Pydantic models

- `AssetCreate`: name (required, 2-50 chars), category (enum), currency (optional)
- `AssetUpdate`: all fields optional
- `AssetResponse`: all fields including id, timestamps

## Acceptance criteria

- [ ] All 5 endpoints working
- [ ] Pydantic validation: name length, category enum, unique name check
- [ ] Standard response format: `{ "data": ..., "error": null }`
- [ ] Tests: happy path + validation errors + not found + duplicate name
- [ ] Repository uses parameterized queries only
```

### Issue #6 — Tags CRUD API

```
Title: [M1] Tags CRUD API endpoints
Labels: backend, API, M1-reference-data

## Description

Implement full CRUD for trading tags (criteria like "Double Top",
"Break of structure", "Pullback to level", etc.).
Replaces the old setups + entries split from TraderPro.

## Endpoints

- `GET /api/tags` — list all (optional `?active=true`)
- `GET /api/tags/{id}` — get single
- `POST /api/tags` — create
- `PUT /api/tags/{id}` — update
- `DELETE /api/tags/{id}` — soft delete

## Pydantic models

- `TagCreate`: name (3-100 chars, required), description (optional, max 500)
- `TagUpdate`: all fields optional
- `TagResponse`: all fields including id, is_active, timestamps

## Acceptance criteria

- [ ] All 5 endpoints, standard response format
- [ ] Unique name validation
- [ ] Tests covering CRUD + validation + edge cases
```

### Issue #7 — Emotions CRUD API

```
Title: [M1] Emotions CRUD API endpoints
Labels: backend, API, M1-reference-data

## Description

CRUD for trading emotions. Has severity (Good/Bad/Warning) and
category fields, unlike simple tags.

## Endpoints

- `GET /api/emotions` — list all (optional `?category=...` filter)
- `GET /api/emotions/{id}` — get single
- `GET /api/emotions/grouped` — returns emotions grouped by category
- `POST /api/emotions` — create
- `PUT /api/emotions/{id}` — update
- `DELETE /api/emotions/{id}` — hard delete

## Validation

- severity must be one of: Good, Bad, Warning
- category must be one of: Emotional State, Mental Triggers, Focus & Clarity,
  Execution Confidence, Why This Trade?

## Acceptance criteria

- [ ] All endpoints with severity/category validation
- [ ] Grouped endpoint returns `{ "data": { "Emotional State": [...], ... } }`
- [ ] Tests
```

### Issue #8 — Settings page UI (frontend)

```
Title: [M1] Settings page with reference data management
Labels: frontend, UI, M1-reference-data

## Description

Build the Settings page with tabs for managing each reference data type.
Each tab has a list view + add/edit modal.

## UI structure

- Mantine `Tabs` component with 3 tabs: Assets, Tags, Emotions
- Each tab:
  - Mantine `Table` listing items (name, description/category, active status)
  - "Add" button -> Mantine `Modal` with form
  - Edit button per row -> same modal, pre-filled
  - Deactivate/activate toggle per row
- Emotions tab: grouped by category, severity shown as colored badge
  (green=Good, orange=Warning, red=Bad — per design system: red=loss semantics)

## Acceptance criteria

- [ ] All 3 tabs functional with full CRUD
- [ ] Forms use Mantine form components with validation
- [ ] Loading states (skeletons), error states (notifications), empty states
- [ ] Responsive: table scrolls horizontally on mobile
- [ ] Follows DESIGN_SYSTEM.md (dark theme, Mantine tokens, no hardcoded colors)

## Dependencies

- Issues #5, #6, #7 (backend APIs)
```

---

## M2 — Trade journal (core MVP)

Goal: log, view, edit, delete trades. The app is usable for daily journaling.

### Issue #9 — Trades CRUD API

```
Title: [M2] Trades CRUD API endpoints
Labels: backend, API, M2-trade-journal

## Description

The main endpoint. A trade is complex: it has activities (buy/sell),
references to tags and emotions, calculated metrics, and screenshots.

## Endpoints

- `GET /api/trades` — list trades (filters: year, asset_id, status, direction)
- `GET /api/trades/{id}` — full trade detail with joined data
- `POST /api/trades` — create trade with activities
- `PUT /api/trades/{id}` — update trade
- `DELETE /api/trades/{id}` — hard delete (cascade)
- `GET /api/trades/years` — list years that have trades

## Business logic (service layer)

Auto-calculate on save:
- direction (from first activity type)
- avg_entry_price, avg_exit_price (weighted average from activities)
- risk (distance from avg entry to SL, in price units)
- reward (distance from avg entry to avg exit)
- performance_r (reward / risk)
- trade_date (date of first activity)
- status inference: Open if no exit activities, Closed if fully exited

## Acceptance criteria

- [ ] All endpoints working with complex nested data
- [ ] Activities stored in trade_activities table, returned nested in trade response
- [ ] Junction tables populated for tags and emotions
- [ ] Calculated fields auto-computed on create/update
- [ ] Year filter returns distinct years
- [ ] Tests: CRUD, calculation accuracy, cascade delete, filter combinations
```

### Issue #10 — Trade screenshots upload API

```
Title: [M2] Trade screenshot upload and retrieval API
Labels: backend, API, M2-trade-journal

## Description

Allow uploading screenshots for trades, associated with a timeframe.

## Endpoints

- `POST /api/trades/{id}/screenshots` — upload image (multipart)
- `GET /api/trades/{id}/screenshots` — list screenshots for trade
- `DELETE /api/screenshots/{screenshot_id}` — delete single screenshot
- `GET /api/screenshots/{filename}` — serve image file

## Acceptance criteria

- [ ] File stored in `data/screenshots/{trade_id}/`
- [ ] Validated: image types only (jpg, png, webp), max 5MB
- [ ] Timeframe (unit + value) stored with screenshot
- [ ] Filename sanitized, no path traversal
- [ ] Tests
```

### Issue #11 — Trade list page (frontend)

```
Title: [M2] Trade list page (journal view)
Labels: frontend, UI, M2-trade-journal

## Description

Main journal page showing all trades for a selected year.

## UI

- Year selector (dropdown or segmented control)
- Mantine Table with columns:
  - Date, Asset, Direction (Long/Short badge), Status badge,
    P&L (colored), R value (monospace)
- Click row -> navigate to trade detail
- "Add trade" button (top right)
- Empty state when no trades for selected year

## Acceptance criteria

- [ ] Trades load for selected year
- [ ] P&L colored green/red per design system
- [ ] Financial numbers in JetBrains Mono, right-aligned
- [ ] Responsive (horizontal scroll on mobile)
- [ ] Loading skeleton while fetching
```

### Issue #12 — Trade form (add/edit)

```
Title: [M2] Trade form — add and edit
Labels: frontend, UI, M2-trade-journal

## Description

Complex form for creating and editing trades. Most complex UI in the app.

## Form sections

1. **Asset**: Mantine Select, grouped by category
2. **Activities**: dynamic list of buy/sell rows
   - Each: date, type (Buy/Sell), price, quantity
   - Add/remove buttons, at least one required
3. **Risk**: stop loss price, risk per trade (%)
4. **Tags**: multi-select from available tags
5. **Emotions**: multi-select grouped by category, severity badges
6. **Timeframe**: entry timeframe (unit + value)
7. **Notes**: textarea
8. **Missed opportunity**: checkbox

## Acceptance criteria

- [ ] Form validates before submit (client + server)
- [ ] Activities are dynamic (add/remove rows)
- [ ] Selectors load reference data from API
- [ ] Edit mode pre-fills all fields from existing trade
- [ ] Submit shows loading state, redirects on success, shows errors on failure
- [ ] Responsive layout (stacks on mobile)
```

### Issue #13 — Trade detail page

```
Title: [M2] Trade detail page
Labels: frontend, UI, M2-trade-journal

## Description

Read-only view of a single trade with all details.

## Sections

- Header: asset name, date, direction badge, status badge
- Key metrics row: P&L, R value, risk/reward, duration
- Activities timeline
- Tags (pill badges)
- Emotions (grouped by category, severity-colored badges)
- Notes
- Screenshots (grouped by timeframe, clickable to enlarge)
- Edit / Delete actions

## Acceptance criteria

- [ ] All trade data displayed
- [ ] P&L and R values with proper coloring and monospace
- [ ] Delete with confirmation modal
- [ ] Responsive
```

---

## M3 — Dashboard

Issues TBD after M2 completion. Key components:
- Statistics computation service (backend)
- Dashboard page with metric cards (total trades, P&L, win rate, profit factor, expectancy)
- Equity curve chart (TradingView Lightweight Charts)
- Monthly performance grid
- Open positions card
- Recent trades card

## M4 — Analytics

Issues TBD. Key components:
- Filter engine (backend service for multi-criteria trade filtering)
- Analytics page with filter bar
- Performance by asset breakdown
- Performance by tag breakdown
- Time heatmap (best trading days/hours)
- Emotion correlation analysis

## M5 — Projections

Issues TBD. Key components:
- Expectancy calculation service
- Projection curves (optimistic/pessimistic via +/-1 std dev)
- Real vs projected comparison
- Asset-level projections

## M6 — Advanced features (future)

- IBKR integration (historical candles via IB API)
- MCP server (expose trading data to AI assistants)
- Tauri desktop wrapper
- TraderPro data import (JSON + Fernet -> SQLite)
