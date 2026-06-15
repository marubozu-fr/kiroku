# 記録 Kiroku

A local-first trading journal built for traders who want full control over their data.

Kiroku runs entirely on your machine. Log your trades, track your performance in R-multiples, and improve your trading — your data never leaves your computer.

## Features

- **Trade Journal** — Log trades with entries/exits, stop-loss, take-profit, partial TPs, screenshots, tags, and emotions
- **Dashboard** — Key metrics (win rate, profit factor, average R), equity curve, and monthly breakdown
- **Analytics** — R-distribution, cumulative R curve, asset/tag breakdowns, time heatmap, and trades table with filters
- **Projections** — Data-driven equity and growth forecasts with scenario comparison
- **Settings** — Manage your assets, tags, and emotions catalogs
- **Economic Calendar** — Forex Factory integration showing macro events (CPI, NFP, FOMC…) on the trade calendar, filtered by currency and impact level
- **Multi-language** — English, French, Spanish, Italian, German, Portuguese
- **R-Multiple Focus** — All performance measured in R-multiples; no dollar amounts displayed

## Prerequisites

| Tool | Version | What for |
|------|---------|----------|
| [Python](https://www.python.org/downloads/) | 3.12–3.13 | Backend runtime |
| [Node.js](https://nodejs.org/) | 22+ | Frontend tooling |
| [uv](https://docs.astral.sh/uv/getting-started/installation/) | latest | Python package manager |
| [pnpm](https://pnpm.io/installation) | 11+ | Node package manager |

<details>
<summary><strong>macOS</strong> (Homebrew)</summary>

```bash
brew install python@3.13 node uv pnpm
```
</details>

<details>
<summary><strong>Linux</strong> (Debian / Ubuntu)</summary>

```bash
sudo apt update && sudo apt install python3.12 nodejs npm
curl -LsSf https://astral.sh/uv/install.sh | sh
npm install -g pnpm
```
</details>

<details>
<summary><strong>Windows</strong> (winget)</summary>

```powershell
winget install Python.Python.3.12
winget install OpenJS.NodeJS
powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"
npm install -g pnpm
```
</details>

## Quick Start

```bash
git clone --branch v0.6.4 --depth 1 https://github.com/marubozu-fr/kiroku.git
cd kiroku
make dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

> **Windows without `make`:** install [Make for Windows](https://gnuwin32.sourceforge.net/packages/make.htm), use [WSL](https://learn.microsoft.com/en-us/windows/wsl/install), or start each service manually:
>
> ```powershell
> # Terminal 1 — backend
> cd backend
> uv run uvicorn app.main:app --reload --port 8000
>
> # Terminal 2 — frontend
> cd frontend
> pnpm install
> pnpm dev
> ```

### Install a specific version

```bash
git clone https://github.com/marubozu-fr/kiroku.git
cd kiroku
git checkout v0.6.4
make dev
```

Stable versions are listed on the [Releases](https://github.com/marubozu-fr/kiroku/releases) page.

## Updating

```bash
git fetch --tags
git checkout v0.6.4
make install
make dev
```

Your data (trades, screenshots, settings) is stored in `backend/data/` which
is not tracked by git — updates never touch your data. Schema migrations, if
any, are applied automatically on startup.

## Custom hostname (optional)

Access Kiroku at `http://kiroku:5173` instead of `http://localhost:5173`.

Add a line to your hosts file:

**macOS / Linux:**
```bash
echo "127.0.0.1 kiroku" | sudo tee -a /etc/hosts
```

**Windows** (PowerShell as Administrator):
```powershell
Add-Content -Path C:\Windows\System32\drivers\etc\hosts -Value "127.0.0.1 kiroku"
```

Then open [http://kiroku:5173](http://kiroku:5173).

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Python 3.12 · FastAPI · SQLite |
| Frontend | React 18 · TypeScript · Mantine v7 |
| Charts | Recharts |
| i18n | react-i18next (6 languages) |
| CI | GitHub Actions |

## Project Structure

````
kiroku/
├── backend/            # FastAPI REST API
│   ├── app/
│   │   ├── main.py     # App entry point
│   │   ├── routers/    # HTTP handlers
│   │   ├── models/     # Pydantic schemas
│   │   ├── services/   # Business logic
│   │   ├── repositories/  # Database access
│   │   └── database.py
│   └── tests/
├── frontend/           # React + TypeScript UI
│   └── src/
│       ├── pages/      # Route-level components
│       ├── components/ # Reusable UI
│       ├── services/   # API client
│       ├── types/      # TypeScript interfaces
│       └── i18n/       # Translations
├── docs/               # Design system, architecture
├── Makefile
└── README.md
````

## Development

```bash
make dev        # Start backend + frontend
make test       # Run all tests (pytest + vitest)
make lint       # Lint + typecheck everything
make install    # Install all dependencies
```

Individual commands:

| Task | Command |
|------|---------|
| Backend server | `cd backend && uv run uvicorn app.main:app --reload --port 8000` |
| Frontend server | `cd frontend && pnpm dev` |
| Backend tests | `cd backend && uv run pytest` |
| Frontend tests | `cd frontend && pnpm test` |
| Backend lint | `cd backend && uv run ruff check .` |
| Frontend lint | `cd frontend && pnpm lint` |
| Frontend typecheck | `cd frontend && pnpm typecheck` |

## License

[AGPL-3.0](LICENSE)
