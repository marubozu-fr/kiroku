---
name: create-component
description: Scaffold a new React component following the design system and project conventions.
disable-model-invocation: true
---
Create a new React component for: $ARGUMENTS

1. Read `docs/DESIGN_SYSTEM.md` to understand the visual conventions
2. Determine if this is a page component (`src/pages/`) or a reusable component (`src/components/`)
3. Check existing components for similar patterns: `ls frontend/src/components/`
4. Create the component file in PascalCase: `<ComponentName>.tsx`
5. Create the CSS Module alongside it: `<ComponentName>.module.css`
6. Follow these conventions:
   - Use Mantine components wherever possible (Button, Table, Card, Modal, TextInput, etc.)
   - Use CSS Modules for custom styling — reference Mantine theme tokens via CSS variables
   - TypeScript strict: define props interface, no `any` types
   - Include loading state, error state, and empty state handling
   - Use `src/services/` for any API calls, not direct fetch
   - Define TypeScript types in `src/types/` if they don't exist yet
7. If the component needs data from the API:
   - Create or update the service in `src/services/<resource>.ts`
   - Create a custom hook in `src/hooks/use<Resource>.ts` if the logic is reusable
8. Write a test file: `<ComponentName>.test.tsx`
   - Test rendering, user interactions, loading/error states
9. Run tests: `cd frontend && pnpm test`
10. Run linter: `cd frontend && pnpm lint`
