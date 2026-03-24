#!/bin/bash
# NSFW-Away — Smoke Test Script
# Validates structural integrity of the extension beyond file existence.

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

PASS=0
FAIL=0

smoke_check() {
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

echo "=== NSFW-Away Smoke Tests ==="
echo ""

# Check that background.js contains required patterns
echo "Checking background.js patterns..."
smoke_check "API namespace shim" "$(grep -q 'typeof browser' background.js && echo true || echo false)"
smoke_check "NSFW cache handling" "$(grep -q 'nsfwCache' background.js && echo true || echo false)"
smoke_check "declarativeNetRequest usage" "$(grep -q 'declarativeNetRequest' background.js && echo true || echo false)"
smoke_check "webRequest usage" "$(grep -q 'webRequest' background.js && echo true || echo false)"
smoke_check "Message listener" "$(grep -q 'onMessage' background.js && echo true || echo false)"
smoke_check "checkNSFW handler" "$(grep -q 'checkNSFW' background.js && echo true || echo false)"
smoke_check "checkNSFWBatch handler" "$(grep -q 'checkNSFWBatch' background.js && echo true || echo false)"
smoke_check "checkNavigation handler" "$(grep -q 'checkNavigation' background.js && echo true || echo false)"
smoke_check "Fail-open policy" "$(grep -q 'fail-open\|fail open' background.js && echo true || echo false)"
smoke_check "Reddit API URL" "$(grep -q 'reddit.com/r/' background.js && echo true || echo false)"
smoke_check "30-day cache TTL" "$(grep -q '2592000000' background.js && echo true || echo false)"

echo ""
echo "Checking content.js patterns..."
smoke_check "API namespace shim" "$(grep -q 'typeof browser' content.js && echo true || echo false)"
smoke_check "Navigation fallback" "$(grep -q 'window.stop' content.js && echo true || echo false)"
smoke_check "MutationObserver" "$(grep -q 'MutationObserver' content.js && echo true || echo false)"
smoke_check "Shadow DOM handling" "$(grep -q 'shadowRoot' content.js && echo true || echo false)"
smoke_check "NSFW class selector" "$(grep -q 'text-category-nsfw' content.js && echo true || echo false)"
smoke_check "NSFW icon selector" "$(grep -q 'nsfw-fill' content.js && echo true || echo false)"
smoke_check "Search telemetry tracker" "$(grep -q 'search-telemetry-tracker' content.js && echo true || echo false)"
smoke_check "Divider cleanup" "$(grep -q 'list-divider-line' content.js && echo true || echo false)"

echo ""
echo "Checking popup files..."
smoke_check "Popup HTML has toggle" "$(grep -q 'toggle' popup/popup.html && echo true || echo false)"
smoke_check "Popup HTML has whitelist input" "$(grep -q 'whitelist-input' popup/popup.html && echo true || echo false)"
smoke_check "Popup CSS has dark mode" "$(grep -q 'prefers-color-scheme' popup/popup.css && echo true || echo false)"
smoke_check "Popup JS has storage.local" "$(grep -q 'storage.local' popup/popup.js && echo true || echo false)"
smoke_check "Popup JS has add/remove whitelist" "$(grep -q 'addToWhitelist\|removeFromWhitelist' popup/popup.js && echo true || echo false)"

echo ""
echo "Checking manifest.json structure..."
smoke_check "Has service_worker" "$(node -e "const m=JSON.parse(require('fs').readFileSync('manifest.json','utf8'));console.log(!!m.background.service_worker)" 2>/dev/null)"
smoke_check "Has content_scripts" "$(node -e "const m=JSON.parse(require('fs').readFileSync('manifest.json','utf8'));console.log(m.content_scripts.length>0)" 2>/dev/null)"
smoke_check "Content script runs at document_start" "$(node -e "const m=JSON.parse(require('fs').readFileSync('manifest.json','utf8'));console.log(m.content_scripts[0].run_at==='document_start')" 2>/dev/null)"
smoke_check "Has gecko settings" "$(node -e "const m=JSON.parse(require('fs').readFileSync('manifest.json','utf8'));console.log(!!m.browser_specific_settings?.gecko)" 2>/dev/null)"
smoke_check "Has action popup" "$(node -e "const m=JSON.parse(require('fs').readFileSync('manifest.json','utf8'));console.log(!!m.action?.default_popup)" 2>/dev/null)"

echo ""
echo "==========================="
echo "Results: $PASS passed, $FAIL failed"
echo "==========================="

if [ $FAIL -gt 0 ]; then
  exit 1
fi

echo "Smoke tests PASSED"
exit 0
