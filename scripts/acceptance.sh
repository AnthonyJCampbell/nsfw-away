#!/bin/bash
# NSFW-Away — Acceptance Test Checklist
# Validates that acceptance criteria from ACCEPTANCE.md are structurally met.
# (Actual runtime behavior requires manual browser testing.)

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

PASS=0
FAIL=0

accept_check() {
  local desc="$1"
  local result="$2"
  if [ "$result" = "true" ]; then
    echo "  [OK] $desc"
    PASS=$((PASS + 1))
  else
    echo "  [FAIL] $desc"
    FAIL=$((FAIL + 1))
  fi
}

echo "=== NSFW-Away Acceptance Criteria ==="
echo ""

echo "Journey 1: Visit NSFW subreddit → redirect"
accept_check "DNR redirect rules in background.js" "$(grep -q 'REDIRECT_URL\|redirect.*url' background.js && echo true || echo false)"
accept_check "Content script fallback redirect" "$(grep -q 'location.replace' content.js && echo true || echo false)"
accept_check "Whitelist check before blocking" "$(grep -q 'isWhitelisted' background.js && echo true || echo false)"
accept_check "document_start in manifest" "$(grep -q 'document_start' manifest.json && echo true || echo false)"

echo ""
echo "Journey 2: Search filtering"
accept_check "Community selector filter" "$(grep -q 'search-community' content.js && echo true || echo false)"
accept_check "Post selector filter" "$(grep -q 'search-post-unit' content.js && echo true || echo false)"
accept_check "Author selector filter" "$(grep -q 'search-author' content.js && echo true || echo false)"
accept_check "Autocomplete NSFW filter" "$(grep -q 'nsfw_typeahead_section\|nsfw.*i\]' content.js && echo true || echo false)"
accept_check "Divider cleanup" "$(grep -q 'list-divider-line' content.js && echo true || echo false)"
accept_check "MutationObserver for live updates" "$(grep -q 'MutationObserver' content.js && echo true || echo false)"

echo ""
echo "Journey 3: Whitelist management"
accept_check "Whitelist input in popup" "$(grep -q 'whitelist-input' popup/popup.html && echo true || echo false)"
accept_check "Add button in popup" "$(grep -q 'whitelist-add' popup/popup.html && echo true || echo false)"
accept_check "Remove functionality" "$(grep -q 'removeFromWhitelist' popup/popup.js && echo true || echo false)"
accept_check "Case-insensitive storage" "$(grep -q 'toLowerCase' popup/popup.js && echo true || echo false)"
accept_check "Duplicate prevention" "$(grep -q 'includes' popup/popup.js && echo true || echo false)"
accept_check "Persists to storage.local" "$(grep -q 'storage.local.set' popup/popup.js && echo true || echo false)"

echo ""
echo "Journey 4: Toggle on/off"
accept_check "Toggle in popup HTML" "$(grep -q 'toggle' popup/popup.html && echo true || echo false)"
accept_check "Toggle persists to storage" "$(grep -q 'storage.local.set.*enabled' popup/popup.js && echo true || echo false)"
accept_check "Background checks enabled state" "$(grep -q 'enabled' background.js && echo true || echo false)"
accept_check "Content script respects enabled" "$(grep -q 'isNSFW.*false' background.js && echo true || echo false)"
accept_check "Icon updates on toggle" "$(grep -q 'updateIcon\|setIcon' background.js && echo true || echo false)"
accept_check "Disabled notice in popup" "$(grep -q 'disabled-notice' popup/popup.html && echo true || echo false)"

echo ""
echo "Journey 5: First install"
accept_check "Default enabled=true" "$(grep -q 'enabled.*=.*true\|enabled.*true' background.js && echo true || echo false)"
accept_check "Default empty whitelist" "$(grep -q 'whitelist.*=.*\[\]' background.js && echo true || echo false)"
accept_check "No onboarding flow" "$(! grep -q 'onboarding\|welcome\|setup' popup/popup.html && echo true || echo false)"

echo ""
echo "==========================="
echo "Results: $PASS passed, $FAIL failed"
echo "==========================="

if [ $FAIL -gt 0 ]; then
  exit 1
fi

echo "Acceptance checks PASSED"
exit 0
