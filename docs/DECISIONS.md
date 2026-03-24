# Architecture Decision Records

## ADR-001: Zero Dependencies, Vanilla JS

**Status:** Accepted

**Context:** Browser extensions benefit from small bundle size, fast load times, and minimal attack surface. Adding a framework or build tool introduces complexity, supply-chain risk, and a build step.

**Decision:** Use only vanilla JavaScript, HTML, and CSS. No npm packages, no bundler, no transpiler.

**Consequences:**
- No build step required; load directly from source
- Slightly more boilerplate for DOM manipulation
- No supply-chain vulnerabilities
- Easy to audit the entire codebase

---

## ADR-002: Single manifest.json for Chrome + Firefox

**Status:** Accepted

**Context:** Chrome and Firefox both support Manifest V3, but with minor differences (e.g., `background.service_worker` vs `background.scripts`). Maintaining two manifests adds overhead.

**Decision:** Use a single `manifest.json` that includes both `background.service_worker` (Chrome) and `background.scripts` (Firefox). Each browser ignores the keys it does not recognize.

**Consequences:**
- One manifest to maintain
- Firefox may log warnings for unrecognized keys (harmless)
- Must test in both browsers after any manifest change

---

## ADR-003: API Namespace Shim (browser vs chrome)

**Status:** Accepted

**Context:** Chrome uses the `chrome.*` namespace. Firefox supports both `browser.*` (with Promises) and `chrome.*` (with callbacks). Using `browser.*` with a shim is the cleanest approach.

**Decision:** Add a shim at the top of every script:
```js
const api = typeof browser !== 'undefined' ? browser : chrome;
```

**Consequences:**
- Consistent Promise-based API usage
- Must remember to use `api.*` instead of `chrome.*` or `browser.*` directly
- Shim must appear before any API calls

---

## ADR-004: Dual Blocking Strategy

**Status:** Accepted

**Context:** Chrome MV3 requires Declarative Net Request (DNR) for request blocking. Firefox MV3 still supports `webRequest.onBeforeRequest` with blocking. Neither approach alone covers both browsers.

**Decision:** Use three layers:
1. **Chrome:** DNR rules for known NSFW subreddits
2. **Firefox:** `webRequest.onBeforeRequest` listener
3. **Content script fallback:** Detect NSFW page after load and redirect

**Consequences:**
- Chrome blocking is declarative and efficient (no background wake needed)
- Firefox blocking uses the familiar webRequest model
- Content script fallback catches anything the other layers miss
- More code paths to maintain and test

---

## ADR-005: Cache as Serialized Array in storage.local

**Status:** Accepted

**Context:** The NSFW lookup cache needs to persist across service worker restarts (Chrome MV3 terminates service workers). `storage.local` is the most reliable persistence layer.

**Decision:** Store cache as a serialized array of `[subreddit, {nsfw, timestamp}]` entries in `storage.local`. On startup, deserialize into an in-memory `Map` for fast lookups.

**Consequences:**
- Survives service worker termination
- Fast in-memory reads during normal operation
- Must re-hydrate Map on every service worker wake
- Storage size limited (typically 5MB for `storage.local`, ample for this use case)

---

## ADR-006: Fail-Open Policy on API Errors

**Status:** Accepted

**Context:** The Reddit API may be unreachable, rate-limited, or return errors. Blocking content when the API is down would break the user's browsing experience.

**Decision:** If the Reddit API returns an error or is unreachable, treat the subreddit as SFW (do not block). Log the error for debugging.

**Consequences:**
- Users can always browse Reddit, even if the API is down
- Some NSFW content may slip through during API outages
- Errors are logged for debugging, not surfaced to the user
- Cached results are still used if available

---

## ADR-007: Icons Generated via Node.js Script

**Status:** Accepted

**Context:** Extension icons are needed at 16, 32, 48, and 128px in both active and inactive variants. Hand-creating 8 PNG files is tedious and error-prone.

**Decision:** Write a Node.js script (`scripts/generate-icons.js`) that programmatically generates all icon variants using the `canvas` package (the only dev-time dependency, not shipped with the extension).

**Consequences:**
- Consistent icon generation
- Easy to regenerate if design changes
- Requires Node.js to run (dev-time only)
- Generated PNGs are committed to the repo
