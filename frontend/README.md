# Kiroku Frontend

React + TypeScript + Vite frontend for the Kiroku trading journal, using Mantine UI
(dark theme) and React Router. See `../docs/DESIGN_SYSTEM.md` for visual conventions.

## Stack

- React 18 + TypeScript (strict mode)
- Vite (dev server on port 5173, proxies `/api` → `http://localhost:8000`)
- Mantine UI v7 — dark theme default, light/dark toggle
- React Router v6
- CSS Modules only (no Tailwind, no styled-components)
- `@/` path alias maps to `src/`

## Scripts

```bash
pnpm dev        # Start dev server on http://localhost:5173
pnpm build      # Type-check (tsc -b) and produce a production build
pnpm typecheck  # Type-check only
pnpm lint       # Run ESLint
pnpm preview    # Preview the production build
```

## Structure

```
src/
├── components/   # Reusable components (AppLayout, ...)
├── pages/        # Page-level components (one per route)
├── services/     # API client (api.ts — base fetch wrapper)
├── types/        # Shared TypeScript interfaces (ApiResponse<T>)
└── theme/        # Mantine theme overrides
```
