#!/usr/bin/env bash
# init.sh — one-click restore to a known-good, executable state.
# Safe by design: installs deps, builds, and runs the full local check suite.
# Does NOT deploy, write to remote KV, or release. See AGENTS.md → Refactor Harness.
set -euo pipefail

cd "$(dirname "$0")"

step() { printf '\n\033[1;34m▶ %s\033[0m\n' "$1"; }

if ! command -v bun >/dev/null 2>&1; then
  echo "✘ bun is required (>=1.2). Install: https://bun.com" >&2
  exit 1
fi

# gitleaks is an optional prerequisite for the pre-commit secret scan (not an npm dep).
# Absent → the hook skips the scan gracefully; install to enable it.
if ! command -v gitleaks >/dev/null 2>&1; then
  echo "⚠ gitleaks not found — pre-commit secret scanning will be skipped. Install: brew install gitleaks"
fi

step "1/5 Install dependencies (bun, frozen lockfile)"
bun install --frozen-lockfile

step "2/5 Lint"
bun run lint

step "3/5 Typecheck"
bun run typecheck

step "4/5 Unit tests"
bun run test

step "5/5 Build (Worker bundle)"
bun run build

cat <<'DONE'

✅ Ready. The project builds and all checks pass.

Next steps:
  bun run dev                 # Vite + Wrangler local dev (HMR)
  bun run preview             # serve the production build locally
  bun run test:visual:update  # establish LOCAL visual baseline (untracked, darwin-specific)
  bun run test:visual         # local before/after visual diff (PV human gate, not CI)

Reminders are cron-driven; high-risk ops (real KV writes, deploy, release,
git push / PR) require explicit authorization — see AGENTS.md → Refactor Harness.
DONE
