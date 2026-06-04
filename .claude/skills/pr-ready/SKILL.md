---
name: pr-ready
description: Run all quality checks before opening a PR. Linting, tests, security review, code review, and design review.
disable-model-invocation: true
---
Run the full quality pipeline on the current branch before creating a PR.

1. **Lint check**
   - Backend: `cd backend && ruff check .`
   - Frontend: `cd frontend && pnpm lint`
   - Fix any issues found

2. **Type check**
   - Frontend: `cd frontend && pnpm tsc --noEmit`
   - Fix any TypeScript errors

3. **Test suite**
   - Backend: `cd backend && pytest -v`
   - Frontend: `cd frontend && pnpm test`
   - All tests must pass. Fix failures before proceeding.

4. **Security review**
   - Use the security-reviewer agent to scan changed files
   - Fix any CRITICAL or HIGH findings

5. **Code review**
   - Use the code-reviewer agent to review the diff: `git diff main...HEAD`
   - Address all MUST FIX findings

6. **Design review** (if frontend changes exist)
   - Use the ui-designer agent to review any new or modified components
   - Verify compliance with docs/DESIGN_SYSTEM.md

7. **Summary**
   - List all files changed
   - List all tests added/modified
   - List any remaining findings that were intentionally deferred
   - Confirm the branch is ready for PR
