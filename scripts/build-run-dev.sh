#!/usr/bin/env bash
# build-run-dev.sh
#
# Clean, install, type-check, run unit tests, then start the dev servers.
# Safe to run from either the project root or the scripts/ directory.

set -euo pipefail

# ── Resolve project root ──────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${ROOT_DIR}"

# ── Helpers ───────────────────────────────────────────────────────────────────
bold()    { printf '\033[1m%s\033[0m\n'    "$*"; }
success() { printf '\033[1;32m✓ %s\033[0m\n' "$*"; }
step()    { printf '\n\033[1;34m▶ %s\033[0m\n' "$*"; }
warn()    { printf '\033[1;33m⚠ %s\033[0m\n'  "$*"; }

bold "╔══════════════════════════════════════╗"
bold "║       RaceStats — Dev Build          ║"
bold "╚══════════════════════════════════════╝"

# ── 1. Clean build artifacts ──────────────────────────────────────────────────
step "Cleaning build artifacts"
rm -rf packages/server/dist packages/client/dist
success "Clean"

# ── 2. Install dependencies ───────────────────────────────────────────────────
step "Installing dependencies"
npm install
success "Dependencies installed"

# ── 3. Type-check server ──────────────────────────────────────────────────────
step "Type-checking server"
npm run build --workspace=packages/server
success "Server type-check passed"

# ── 4. Type-check client ──────────────────────────────────────────────────────
# tsc --noEmit is used for the client (Vite owns the actual bundle in dev mode).
step "Type-checking client"
npx tsc --noEmit --project packages/client/tsconfig.json
success "Client type-check passed"

# ── 5. Unit tests ─────────────────────────────────────────────────────────────
step "Running unit tests"
# Capture output and exit code separately so set -e doesn't fire prematurely,
# and so a real test failure is distinguished from "no test files found".
set +e
TEST_OUTPUT=$(npm run test --workspace=packages/server 2>&1)
TEST_EXIT=$?
set -e

if [ "${TEST_EXIT}" -eq 0 ]; then
  success "All tests passed"
elif echo "${TEST_OUTPUT}" | grep -qi 'no test files found\|no tests\|0 tests'; then
  warn "No tests found yet — skipping (add tests under packages/server/src/__tests__)"
else
  # Real failure — print captured output so the developer can see what broke
  echo "${TEST_OUTPUT}"
  exit "${TEST_EXIT}"
fi

# ── 6. Start dev servers ──────────────────────────────────────────────────────
step "Starting dev servers"

# Clear any VITE_API_BASE_URL that may be set in the shell environment from
# another project. If left set, Vite injects it into the app and API calls
# bypass the local proxy, causing "Could not reach the server" errors.
if [ -n "${VITE_API_BASE_URL:-}" ]; then
  warn "Clearing VITE_API_BASE_URL='${VITE_API_BASE_URL}' (was set in shell — would break local proxy)"
  unset VITE_API_BASE_URL
fi

echo ""
echo "  Frontend → http://localhost:5173"
echo "  API      → http://localhost:3001"
echo ""
echo "  Press Ctrl+C to stop both servers."
echo ""

npm run dev
