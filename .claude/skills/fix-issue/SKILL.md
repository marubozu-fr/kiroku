---
name: fix-issue
description: Fix a GitHub issue end-to-end. Reads the issue, implements the fix, writes tests, and opens a PR.
disable-model-invocation: true
---
Fix the GitHub issue: $ARGUMENTS

1. Run `gh issue view $ARGUMENTS` to get the full issue details and acceptance criteria
2. Identify the scope: which files need to change (backend, frontend, or both)
3. Read existing related code to understand current patterns
4. Create a feature branch: `git checkout -b feature/$ARGUMENTS-<short-description>`
5. Implement the changes following CLAUDE.md conventions
6. If backend changes: use the backend-dev agent for implementation
7. If frontend changes: check docs/DESIGN_SYSTEM.md first, then use the frontend-dev agent
8. Write tests using the test-writer agent
9. Run the full test suite and fix any failures
10. Run linters (`ruff check .` for Python, `pnpm lint` for frontend)
11. Commit with a descriptive message: `feat(<scope>): <description> (closes #$ARGUMENTS)`
12. Push the branch and create a PR: `gh pr create --title "<description>" --body "Closes #$ARGUMENTS"`
