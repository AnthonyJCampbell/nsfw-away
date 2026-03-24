# NSFW-Away

A browser extension that silently blocks NSFW content on Reddit.

- **Blocks navigation** to NSFW subreddits (redirects to reddit.com)
- **Filters search results** removing NSFW communities, posts, users, and autocomplete suggestions
- **Whitelist** specific subreddits you still want access to
- **Toggle on/off** without uninstalling

Works on Chrome, Firefox, Edge, Brave, Arc, and other Chromium-based browsers.

## Install

### Chrome / Chromium browsers

1. Open `chrome://extensions/` (or `edge://extensions/`, `brave://extensions/`, etc.)
2. Enable **Developer mode** (toggle in top-right)
3. Click **Load unpacked**
4. Select this project's root directory
5. The NSFW-Away icon appears in your toolbar

### Firefox

1. Open `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on**
3. Select the `manifest.json` file from this project's root directory
4. The NSFW-Away icon appears in your toolbar

## Usage

- **Toggle**: Click the extension icon and use the switch to enable/disable blocking
- **Whitelist**: In the popup, type a subreddit name and click Add. That subreddit will no longer be blocked or filtered. Click the X to remove it from the whitelist.
- The extension works immediately after install with no configuration needed.

## How it works

1. When you visit a subreddit, the extension checks Reddit's public API to determine if it's NSFW (`over18` flag)
2. NSFW status is cached locally for 30 days
3. **Chrome**: Uses `declarativeNetRequest` to redirect NSFW subreddit URLs before the page loads
4. **Firefox**: Uses `webRequest.onBeforeRequest` with blocking to redirect
5. **Both**: A content script running at `document_start` acts as a fallback safety net
6. On search pages, a `MutationObserver` removes NSFW results from the DOM

## Permissions

- `storage` — save settings and NSFW cache locally
- `declarativeNetRequest` — redirect NSFW URLs (Chrome)
- `webRequest` / `webRequestBlocking` — redirect NSFW URLs (Firefox)
- `*://*.reddit.com/*` — access Reddit pages and API

No data leaves your browser except lookups to Reddit's own public API.

## Manual Test Cases

1. **NSFW redirect**: Navigate to `reddit.com/r/nsfw` — should redirect to `reddit.com`
2. **SFW allowed**: Navigate to `reddit.com/r/programming` — should load normally
3. **Search filtering**: Search for a term with NSFW results — NSFW entries should be absent
4. **Whitelist add**: Add a subreddit to whitelist — it should no longer be blocked
5. **Whitelist remove**: Remove it — blocking resumes
6. **Toggle off**: Disable the extension — all blocking stops
7. **Toggle on**: Re-enable — blocking resumes
8. **Persistence**: Close and reopen browser — settings and whitelist persist

## Project Structure

```
manifest.json          # Extension manifest (MV3, Chrome + Firefox)
background.js          # Service worker: NSFW cache, API, blocking rules
content.js             # Content script: navigation fallback + search filtering
popup/
  popup.html           # Popup UI
  popup.css            # Styles (dark mode support)
  popup.js             # Toggle and whitelist logic
icons/
  icon-{16,32,48,128}.png          # Enabled icons
  icon-disabled-{16,32,48,128}.png # Disabled icons
scripts/
  generate-icons.js    # Icon generator (dev tool)
  healthcheck.sh       # File/structure validation
  smoke.sh             # Code pattern checks
  acceptance.sh        # Acceptance criteria validation
docs/                  # Project documentation
```

## Validation Scripts

```bash
./scripts/healthcheck.sh   # Verify all files exist, manifest is valid
./scripts/smoke.sh         # Check code patterns and structure
./scripts/acceptance.sh    # Validate acceptance criteria coverage
```
