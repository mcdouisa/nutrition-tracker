#!/bin/bash
# Enforces Lytz's locked rules (see CLAUDE.md) before Claude runs a tool.
#   deny  = never allowed
#   ask   = the owner must approve this exact action in the app
# Reads the tool call as JSON on stdin.

input=$(cat)
tool=$(printf '%s' "$input" | jq -r '.tool_name // ""')
cmd=$(printf '%s' "$input" | jq -r '.tool_input.command // ""')
path=$(printf '%s' "$input" | jq -r '.tool_input.file_path // .tool_input.path // ""')
repo="$(cd "$(dirname "$0")/../.." && pwd)"

decide() { # $1 = deny|ask, $2 = reason
  jq -n --arg d "$1" --arg r "$2" \
    '{hookSpecificOutput: {hookEventName: "PreToolUse", permissionDecision: $d, permissionDecisionReason: $r}}'
  exit 0
}

if [ "$tool" = "Bash" ]; then
  branch=$(git -C "$repo" rev-parse --abbrev-ref HEAD 2>/dev/null)

  # L2.2: never commit directly on main or staging
  if printf '%s' "$cmd" | grep -Eq '(^|[;&| ])git( -C [^ ]+)? commit' && { [ "$branch" = "main" ] || [ "$branch" = "staging" ]; }; then
    decide deny "L2.2: work on a branch. Never commit directly to $branch."
  fi

  # L1 / L2: no force pushes, no history rewrites on shared branches
  if printf '%s' "$cmd" | grep -Eq 'git( -C [^ ]+)? push.*(--force|--force-with-lease|[[:space:]]-f([[:space:]]|$)|[[:space:]]\+)'; then
    decide deny "Force pushing can erase shipped work. Not allowed."
  fi

  # L2.1: every push needs the owner's OK for that specific change
  if printf '%s' "$cmd" | grep -Eq '(^|[;&| ])git( -C [^ ]+)? push'; then
    decide ask "L2.1: pushing needs the owner's OK for this specific change."
  fi

  # L6.1: new packages need the owner's OK
  if printf '%s' "$cmd" | grep -Eq '(^|[;&| ])(npm|pnpm|yarn|bun)( [^ ]+)* (install|i|add)( |$)'; then
    decide ask "L6.1: adding or installing packages needs the owner's OK."
  fi

  # L3.1: secrets only when the owner asks
  if printf '%s' "$cmd" | grep -Eq '\.env(\.|[[:space:]]|$)'; then
    decide ask "L3.1: this touches a secrets file (.env). Only with the owner's OK."
  fi
  exit 0
fi

if [ -n "$path" ]; then
  rel="${path#$repo/}"
  case "$rel" in
    .env|.env.*|*/.env|*/.env.*)
      decide ask "L3.1: secrets file. Only read or edit it when the owner asks." ;;
    firestore.rules)
      [ "$tool" != "Read" ] && decide ask "L1.4: changing Firestore security rules needs the owner's OK." ;;
    package.json|package-lock.json)
      [ "$tool" != "Read" ] && decide ask "L6.1: changing dependencies needs the owner's OK." ;;
    docs/status.md|docs/decisions.md)
      ;; # the running log: assistants keep these current
    AGENTS.md|CLAUDE.md|GEMINI.md|docs/*|.cursor/rules/*|.github/copilot-instructions.md|.claude/settings.json|.claude/hooks/*)
      [ "$tool" != "Read" ] && decide ask "These are the locked rules. Only the owner changes them." ;;
  esac
fi
exit 0
