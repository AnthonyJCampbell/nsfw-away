# Reddit NSFW Content Blocker, called NSFW-Away (Browser Extension) — SPEC v1.0 (One-Shot Optimized, Cross-Browser)

## 1. Execution safety & environment assumptions

### Safety boundary (must)

- The build agent must treat the repo root as a sandbox and must not read/write/delete outside it.
- No external services, analytics, or telemetry of any kind.
- The only network calls the extension ever makes are to Reddit's own public API (`reddit.com`), and only for NSFW status lookups and (in the future) nothing else.

### Environment assumption (explicit)

- Assume the user has a modern browser installed (Chrome 120+, Firefox 121+, or any Chromium-based browser such as Edge/Brave/Arc).
- Assume Node.js is available for any build/packaging scripts if needed, but the extension itself must have zero build step — raw JS/HTML/CSS loadable directly via "Load unpacked" (Chrome) or `about:debugging` (Firefox).

### Dependency policy

- Zero runtime dependencies. No npm packages, no bundlers, no frameworks.
- Pure vanilla JS, HTML, CSS.
- Single codebase for both Chrome and Firefox. Use runtime detection where APIs diverge.

---

## 2. One-page overview

### What it is

A browser extension that silently removes NSFW content from Reddit. It does two things:

1. **Blocks navigation** — if the user tries to visit an NSFW subreddit, they are redirected to `reddit.com` before the page loads.
2. **Filters search** — NSFW communities, posts, and users are removed from Reddit search results and search autocomplete suggestions.

The user can whitelist specific NSFW subreddits they still want access to, and toggle the entire extension on/off from a popup.

### Who it's for

Anyone who wants a clean Reddit experience at work, in public, or by personal preference — without relying on Reddit's own settings or account state.

### Constraints (must)

- Fully client-side. No backend, no accounts, no cloud.
- Works without a Reddit account (uses Reddit's public JSON API).
- Manifest V3 for both Chrome and Firefox.
- Must not degrade Reddit performance noticeably.
- Must fail open — if the Reddit API is unreachable, allow the subreddit through rather than wrongly blocking.

### Non-goals (explicit)

- No blocking of specific posts within SFW subreddits (only whole-subreddit NSFW status matters).
- No image/video content scanning or analysis.
- No support for old.reddit.com in v1 (new Reddit only).
- No per-subreddit "softblock" or warning interstitial — it's a hard redirect or nothing.
- No sync across devices (local storage only).
- No custom redirect target in v1 — always redirects to `https://www.reddit.com/`.

---

## 3. Prescriptive tech choices (do not bikeshed)

### Extension manifest (required)

- Manifest V3 for both browsers.
- Single `manifest.json` that works on both Chrome and Firefox.
- Use `browser_specific_settings.gecko` block for Firefox addon ID.

### API namespace (required)

- Use `browser` API if available (Firefox), fall back to `chrome` API.
- Define this once at the top of each script:
  ```js
  const api = (typeof browser !== 'undefined' && browser.runtime) ? browser : chrome;
  ```

### Navigation blocking (required, per-browser)

- **Chrome / Chromium**: Use `declarativeNetRequest` with dynamic redirect rules. Rules are generated at runtime from the NSFW cache.
- **Firefox**: Use `webRequest.onBeforeRequest` with `blocking` (Firefox MV3 still supports this).
- **Content script fallback** (both browsers): A content script running at `document_start` checks the current URL against the background script. If NSFW, calls `window.stop()` and `window.location.replace('https://www.reddit.com/')`. This is a safety net for cases where the primary mechanism hasn't caught the subreddit yet.

### Search filtering (required)

- Implemented entirely in a content script using DOM manipulation and `MutationObserver`.
- Must handle Reddit's Shadow DOM (`<reddit-search-large>` custom element) by accessing `.shadowRoot` on the element.
- No polling-only approach — use MutationObservers as primary, with a short initial polling phase (20 checks at 500ms) as a fallback for timing edge cases.

### Storage (required)

- All persistent data in `browser.storage.local` / `chrome.storage.local`.
- No IndexedDB, no localStorage, no cookies.

### Popup UI (required)

- Built with plain HTML + CSS + JS. No framework.
- Accessed via the extension's browser action icon.

---

## 4. NSFW detection (pinned)

### Source of truth

- Reddit's public API: `GET https://www.reddit.com/r/{subreddit}/about.json`
- A subreddit is NSFW if and only if `response.data.over18 === true`.
- User-Agent header: `reddit-nsfw-blocker/1.0`

### Caching (required)

- Cache NSFW status results in `storage.local` under key `nsfwCache`.
- Cache format: a JSON-serialized array of `[subredditName, { isNSFW: boolean, timestamp: number }]` entries.
- **TTL: 30 days** (2,592,000,000 ms).  Expired entries are pruned on load.
- Cache is loaded into an in-memory `Map` on service worker startup.
- Every cache write persists to storage immediately.

### Fail-open policy (must)

- If the Reddit API returns a non-200 status or the fetch throws, treat the subreddit as SFW (allow through).
- Never block a subreddit the extension isn't sure about.

### Chrome DNR rule sync (required)

- On startup and whenever a new NSFW subreddit is discovered, generate a `declarativeNetRequest` dynamic redirect rule for it.
- On startup, clear all existing dynamic rules and regenerate from the current cache (idempotent).
- Rule format:
  - Action: redirect to `https://www.reddit.com/`
  - Condition: `urlFilter: ||reddit.com/r/{subreddit}`, resource type `main_frame` only.

---

## 5. User journeys

### Journey 1 — Visit an NSFW subreddit (core)

**Story:** I type or click a link to an NSFW subreddit and I'm redirected before I see anything.

**Acceptance criteria:**

- Redirect happens before page content renders (no flash of NSFW content).
- The URL in the address bar changes to `https://www.reddit.com/`.
- If the subreddit is whitelisted, no redirect occurs — the page loads normally.
- If the subreddit hasn't been checked yet and the API is slow, the content script fallback catches it within ~1-2 seconds.

### Journey 2 — Search for something on Reddit (core)

**Story:** I search on Reddit and never see NSFW communities, posts, or users in the results.

**Acceptance criteria:**

- NSFW communities are removed from the search results sidebar/list.
- NSFW posts are removed from the main search results feed.
- NSFW users/authors are removed from the people results.
- NSFW subreddit suggestions are removed from the search autocomplete dropdown.
- No empty gaps, orphaned dividers, or visual artifacts left where results were removed.
- Whitelisted NSFW subreddits still appear in search results normally.

### Journey 3 — Whitelist a subreddit (settings)

**Story:** There's an NSFW subreddit I still want access to. I add it to my whitelist.

**Acceptance criteria:**

- I open the extension popup and see a "Whitelist" section.
- I type a subreddit name (without `r/` prefix) and click Add.
- The subreddit immediately stops being blocked/filtered.
- The whitelist is shown as a list. Each entry has a remove button.
- Clicking remove immediately re-enables blocking/filtering for that subreddit.
- Whitelist persists across browser restarts.
- Input is case-insensitive (stored lowercase).
- Duplicate entries are silently ignored.

### Journey 4 — Toggle extension on/off

**Story:** I want to temporarily disable all blocking without uninstalling.

**Acceptance criteria:**

- The popup has a clearly visible on/off toggle at the top.
- When off: no navigation blocking, no search filtering. The extension is effectively dormant.
- When on: all blocking/filtering resumes.
- State persists across browser restarts.
- The extension icon should visually indicate enabled/disabled state (e.g. greyed out icon when disabled, or a badge).

### Journey 5 — First install

**Story:** I install the extension and it works immediately with no setup.

**Acceptance criteria:**

- No onboarding flow, no setup wizard, no permissions to grant beyond what the manifest requests.
- Default state: enabled, empty whitelist (no default whitelist entries).
- Blocking begins on the first Reddit page visit after install.

---

## 6. Popup UI (pinned)

### Layout (required)

Top to bottom:

1. **Extension name** — small header, e.g. "Reddit NSFW Blocker".
2. **Master toggle** — a switch with label "Enabled" / "Disabled". Visually prominent.
3. **Whitelist section** — label "Whitelisted Subreddits".
   - Text input with placeholder "subreddit name" and an "Add" button beside it.
   - Below: list of whitelisted subreddits, each with a remove/delete button (e.g. an "x").
   - If empty, show subtle text: "No whitelisted subreddits."

### Style (required)

- Clean, minimal. Dark-friendly (respect `prefers-color-scheme`).
- Popup width: ~320px. Height: auto, max ~400px with scroll if whitelist is long.
- No branding, no logos, no links, no credits in the popup itself.
- Consistent with native browser UI feel. No heavy styling.

### Behaviour (required)

- Toggle change takes effect immediately (no "Save" button).
- Adding/removing whitelist entries takes effect immediately.
- All changes persist to `storage.local` on every interaction.
- When the extension is disabled, the whitelist section should still be visible and editable, but show a subtle note that blocking is currently off.

---

## 7. Search filtering implementation (pinned)

### What to filter

| Result type | Selector | Scope |
|---|---|---|
| Community | `[data-testid="search-community"]` | Search results page |
| Post | `[data-testid="search-post-unit"]` | Search results page |
| User/Author | `[data-testid="search-author"]` | Search results page |
| Autocomplete NSFW section | `summary[aria-controls*="nsfw" i]` or `#nsfw_typeahead_section` | Search dropdown (Shadow DOM) |

### NSFW detection in DOM (required)

A search result is NSFW if any of these are true (and the subreddit is not whitelisted):

- It contains an element matching `.text-category-nsfw` or `[icon-name="nsfw-fill"]`.
- Its closest `search-telemetry-tracker` ancestor has a `data-faceplate-tracking-context` attribute containing `"nsfw":true`.

### Whitelist check in search (required)

Before removing a result, extract the subreddit name from the `data-faceplate-tracking-context` JSON (`data.subreddit.name`). If it matches a whitelisted subreddit, leave it alone.

### Cleanup (required)

After removing a result element (or its `search-telemetry-tracker` wrapper), also remove any immediately following `hr.list-divider-line` sibling to avoid orphaned dividers.

### Shadow DOM handling (required)

- Reddit's search autocomplete lives inside `<reddit-search-large>` which uses Shadow DOM.
- Access via `element.shadowRoot` and observe with a separate `MutationObserver`.
- Track observed shadow roots with a `WeakSet` to avoid duplicate observers.

---

## 8. Message API between content and background scripts (pinned)

Content scripts communicate with the background script via `runtime.sendMessage`. Three message types:

| Type | Payload | Response | Used by |
|---|---|---|---|
| `checkNSFW` | `{ subreddit: string }` | `{ isNSFW: boolean }` | Search filtering (single check) |
| `checkNSFWBatch` | `{ subreddits: string[] }` | `{ results: [{ subreddit, isNSFW }] }` | Search filtering (batch check) |
| `checkNavigation` | `{ subreddit: string }` | `{ isNSFW: boolean }` | Content script navigation fallback |

All handlers must check the extension's enabled state and return `{ isNSFW: false }` for everything when disabled.

---

## 9. Data model (storage.local)

### Keys

| Key | Type | Default | Description |
|---|---|---|---|
| `enabled` | boolean | `true` | Master on/off toggle |
| `whitelist` | string[] (JSON) | `[]` | Lowercase subreddit names exempt from blocking |
| `nsfwCache` | string (JSON) | `[]` | Serialized `[name, {isNSFW, timestamp}]` entries |

### Notes

- All values stored as JSON strings via `storage.local.set`.
- The background script loads these into memory on startup and keeps them in sync on every write.
- The popup reads/writes directly to `storage.local` — no message passing needed for settings.

---

## 10. Permissions (pinned)

### manifest.json permissions

```json
{
  "permissions": [
    "storage",
    "declarativeNetRequest",
    "webRequest",
    "webRequestBlocking"
  ],
  "host_permissions": [
    "*://*.reddit.com/*"
  ]
}
```

**Note:** `webRequest` and `webRequestBlocking` are only used by Firefox. Chrome ignores them in MV3. This is intentional — a single manifest serves both browsers.

---

## 11. File structure (required)

```
/
  manifest.json
  background.js          # Service worker (Chrome) / background script (Firefox)
  content.js             # Content script: navigation fallback + search filtering
  popup/
    popup.html           # Extension popup UI
    popup.css            # Popup styles
    popup.js             # Popup logic (toggle, whitelist management)
  icons/
    icon-16.png
    icon-32.png
    icon-48.png
    icon-128.png
  README.md              # Brief install + usage instructions
```

No build step. No `src/` vs `dist/`. What's in the repo is what gets loaded.

---

## 12. Icon & badge behaviour (required)

- Provide simple icons at 16, 32, 48, 128px sizes.
- When extension is **disabled**, set the icon to a greyed-out variant or apply a grey badge/overlay to indicate inactive state.
- When extension is **enabled**, show the normal coloured icon.
- No badge text required in v1.

---

## 13. Testing & validation (manual, minimal)

No automated test framework required. Document the following manual test cases in `README.md`:

1. Navigate to a known NSFW subreddit (e.g. `r/nsfw`) — should redirect to `reddit.com`.
2. Navigate to a known SFW subreddit (e.g. `r/programming`) — should load normally.
3. Search for a term that returns NSFW results — NSFW entries should be absent.
4. Add a subreddit to the whitelist — it should no longer be blocked or filtered.
5. Remove it from the whitelist — blocking/filtering resumes.
6. Toggle extension off — all blocking/filtering stops.
7. Toggle extension on — blocking/filtering resumes.
8. Close and reopen browser — settings and whitelist persist.

---

## 14. Out of scope / deferred (explicit)

- old.reddit.com support
- Custom redirect target (always `reddit.com` homepage)
- Sync across devices / browsers
- Import/export whitelist
- Statistics or counters ("X subreddits blocked")
- Per-subreddit soft-block / warning interstitials
- NSFW image/thumbnail blurring within SFW subreddits
- Automated tests or CI pipeline
- Extension store publishing / signing
- Options page separate from popup (popup is the only settings surface)
- Scheduled cache refresh (cache refreshes organically on next visit after TTL expiry)
