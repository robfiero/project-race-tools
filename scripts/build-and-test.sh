#!/usr/bin/env bash
# Clean build of both packages followed by all unit tests.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SERVER="$ROOT/packages/server"
CLIENT="$ROOT/packages/client"

pass() { echo "  ✓ $*"; }
fail() { echo "  ✗ $*"; }
section() { echo; echo "══════════════════════════════════════════"; echo "  $*"; echo "══════════════════════════════════════════"; }

ERRORS=0

# ── 1. Server build ───────────────────────────────────────────────────────────
section "Building server"
if (cd "$SERVER" && npx tsc --noEmit 2>&1); then
  pass "Server TypeScript OK"
else
  fail "Server TypeScript failed"
  ERRORS=$((ERRORS + 1))
fi

# ── 2. Client build ───────────────────────────────────────────────────────────
section "Building client"
if (cd "$CLIENT" && npx tsc --noEmit 2>&1); then
  pass "Client TypeScript OK"
else
  fail "Client TypeScript failed"
  ERRORS=$((ERRORS + 1))
fi

# ── 3. Unit tests (server) ────────────────────────────────────────────────────
section "Running unit tests"
if (cd "$SERVER" && npx vitest run 2>&1); then
  pass "All tests passed"
else
  fail "Some tests failed"
  ERRORS=$((ERRORS + 1))
fi

# ── Summary ───────────────────────────────────────────────────────────────────
echo
if [ "$ERRORS" -eq 0 ]; then
  echo "  ✓ All checks passed"
else
  echo "  ✗ $ERRORS check(s) failed"
  exit 1
fi
