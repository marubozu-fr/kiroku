# 記録 Kiroku

A local-first trading journal built for traders who want full control over their data.

## What is Kiroku?

Kiroku is an open-source trading journal that runs on your machine. Log your trades, analyze your performance, and improve your trading — with your data staying on your computer.

## Features

- **Trade Journal** — Log trades with full detail: entry/exit, stop-loss, take-profit, partial TPs, setups, emotions, screenshots
- **Dashboard** — Equity curve, key metrics, monthly breakdown at a glance
- **Analytics** — Win rate, expectancy, R-unit analysis, performance by asset and setup
- **Projections** — Data-driven forecasts with optimistic/pessimistic scenarios
- **Charts** — TradingView Lightweight Charts embedded for visual trade review
- **IBKR Integration** — Fetch historical candles from Interactive Brokers (optional)
- **AI-Ready** — MCP server for connecting AI assistants to your trading data (coming soon)

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Python, FastAPI, SQLite |
| Frontend | React, TypeScript, Mantine UI |
| Charts | TradingView Lightweight Charts |
| Desktop | Tauri (optional) |

## Quick Start

### Prerequisites

- Python 3.12+
- Node.js 20+
- pnpm

### Installation

```bash
git clone git@github.com:marubozu-fr/kiroku.git
cd kiroku

# Backend
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# Frontend (new terminal)
cd frontend
pnpm install
pnpm dev
```

Open `http://localhost:5173` in your browser.

## Project Structure

```
kiroku/
├── backend/          # FastAPI REST API
├── frontend/         # React + TypeScript UI
├── docs/             # Design system, architecture docs
├── .claude/          # AI development agents and skills
└── CLAUDE.md         # Project conventions
```

## Development

This project uses Claude Code with specialized agents for development. See `.claude/agents/` for the agent definitions and `.claude/skills/` for reusable workflows.

### Development Workflow

1. Every change starts as a GitHub issue
2. Issues are grouped into milestones
3. Each issue is implemented on a feature branch
4. PRs are reviewed by automated agents (code quality, security, design)
5. Merge to main after all checks pass

## License

AGPL-3.0 — See [LICENSE](LICENSE) for details.
