# Lytz — Claude Code

The rules for this project live in `AGENTS.md` so every AI tool shares them. They are imported here in full.

@AGENTS.md

## Also loaded every session
@docs/status.md
@docs/architecture.md
@docs/design-system.md
@docs/testing.md
@docs/decisions.md

## Claude Code specifics
- Some locked rules are enforced automatically by `.claude/settings.json` and `.claude/hooks/guard.sh`: commits on `main`/`staging` and force pushes are blocked; pushes, installs, secrets, Firestore rules, dependencies and edits to the rules files need the owner's approval.
- Track work with the task list, test in the browser pane at phone size, and wrap up each turn with what is and isn't verified.
