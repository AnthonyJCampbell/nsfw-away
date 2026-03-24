#!/bin/bash
# NSFW-Away — Healthcheck Script
# Verifies all required files exist and manifest is valid JSON.

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

PASS=0
FAIL=0

check_file() {
  if [ -f "$1" ]; then
    echo "  [OK] $1"
    PASS=$((PASS + 1))
  else
    echo "  [FAIL] $1 — NOT FOUND"
    FAIL=$((FAIL + 1))
  fi
}

echo "=== NSFW-Away Healthcheck ==="
echo ""
echo "Checking required files..."

check_file "manifest.json"
check_file "background.js"
check_file "content.js"
check_file "popup/popup.html"
check_file "popup/popup.css"
check_file "popup/popup.js"
check_file "icons/icon-16.png"
check_file "icons/icon-32.png"
check_file "icons/icon-48.png"
check_file "icons/icon-128.png"
check_file "icons/icon-disabled-16.png"
check_file "icons/icon-disabled-32.png"
check_file "icons/icon-disabled-48.png"
check_file "icons/icon-disabled-128.png"
check_file "README.md"

echo ""
echo "Checking manifest.json is valid JSON..."
if node -e "JSON.parse(require('fs').readFileSync('manifest.json','utf8'))" 2>/dev/null; then
  echo "  [OK] manifest.json is valid JSON"
  PASS=$((PASS + 1))
else
  echo "  [FAIL] manifest.json is NOT valid JSON"
  FAIL=$((FAIL + 1))
fi

echo ""
echo "Checking manifest_version is 3..."
MV=$(node -e "console.log(JSON.parse(require('fs').readFileSync('manifest.json','utf8')).manifest_version)" 2>/dev/null)
if [ "$MV" = "3" ]; then
  echo "  [OK] manifest_version is 3"
  PASS=$((PASS + 1))
else
  echo "  [FAIL] manifest_version is '$MV' (expected 3)"
  FAIL=$((FAIL + 1))
fi

echo ""
echo "Checking required permissions in manifest..."
PERMS=$(node -e "const m=JSON.parse(require('fs').readFileSync('manifest.json','utf8'));console.log(m.permissions.join(','))" 2>/dev/null)
for perm in storage declarativeNetRequest webRequest webRequestBlocking; do
  if echo "$PERMS" | grep -q "$perm"; then
    echo "  [OK] Permission: $perm"
    PASS=$((PASS + 1))
  else
    echo "  [FAIL] Missing permission: $perm"
    FAIL=$((FAIL + 1))
  fi
done

echo ""
echo "Checking docs directory..."
for doc in SPEC.md PLAN.md TODO.md STATE.md DECISIONS.md RISKS.md COMMANDS.md TESTING.md ARCHITECTURE.md ACCEPTANCE.md RELEASE.md APPROVALS.md PLAYBOOK.md; do
  check_file "docs/$doc"
done

echo ""
echo "==========================="
echo "Results: $PASS passed, $FAIL failed"
echo "==========================="

if [ $FAIL -gt 0 ]; then
  exit 1
fi

echo "Healthcheck PASSED"
exit 0
