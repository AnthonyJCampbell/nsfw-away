# Build Plan

## Phase 0: Scaffold & Docs
- Create directory structure: `docs/`, `scripts/`, `popup/`, `icons/`
- Write all documentation files (SPEC, PLAN, TODO, STATE, DECISIONS, RISKS, etc.)
- Establish project conventions

## Phase 1: Core Extension Skeleton
- Create `manifest.json` with Manifest V3 for both Chrome and Firefox
- Create `background.js` with API namespace shim (`browser` vs `chrome`)
- Create `content.js` skeleton with namespace shim
- Create `popup/popup.html`, `popup/popup.css`, `popup/popup.js` stubs
- Verify extension loads in both Chrome and Firefox without errors

## Phase 2: NSFW Detection & Caching
- Implement Reddit API call to `/r/{subreddit}/about.json`
- Parse `over18` field from API response
- Implement fail-open policy: if API errors, treat subreddit as SFW
- Build in-memory `Map` for NSFW lookup results
- Persist cache to `storage.local` as serialized array
- Implement 30-day TTL per cache entry
- Implement cache pruning on extension startup
- Wire up `checkNSFW` and `checkNSFWBatch` message handlers in background.js

## Phase 3: Navigation Blocking
- Chrome: Add Declarative Net Request (DNR) rules for NSFW subreddits
- Firefox: Add `webRequest.onBeforeRequest` blocking for NSFW subreddits
- Content script fallback: detect NSFW subreddit pages and redirect/block
- Redirect blocked navigations to a safe page (Reddit front page or extension page)
- Respect whitelist — do not block whitelisted subreddits
- Respect enabled/disabled toggle

## Phase 4: Search Filtering
- Identify DOM selectors for Reddit search results, feeds, and sidebars
- Use `MutationObserver` to detect dynamically loaded content
- Hide/remove NSFW subreddit results from search pages
- Handle Shadow DOM elements if Reddit uses them
- Batch-check subreddits found in DOM via `checkNSFWBatch`

## Phase 5: Popup UI
- Toggle switch: enable/disable blocking globally
- Whitelist management: add/remove subreddits
- Dark mode toggle (or auto-detect from system preference)
- Display current subreddit context (if on a subreddit page)
- Save settings to `storage.local`

## Phase 6: Icons & Badge Behavior
- Create `scripts/generate-icons.js` to produce icons at 16, 32, 48, 128px
- Generate active (colored) and inactive (greyed) icon variants
- Set badge text/color based on blocking state
- Update icon when extension is toggled on/off

## Phase 7: Quality Rails & Scripts
- Write `scripts/healthcheck.js` — verify manifest, file existence, JSON validity
- Write `scripts/smoke.js` — basic extension load and message passing test
- Write `scripts/acceptance.js` — automated checks against acceptance criteria
- Document all script commands in COMMANDS.md

## Phase 8: Hardening & Polish
- Add try/catch around all storage operations
- Handle service worker termination/restart (Chrome MV3)
- Handle edge cases: deleted subreddits, private subreddits, quarantined subs
- Rate-limit Reddit API calls (respect 429 responses)
- Test with large whitelists and large caches

## Phase 9: Documentation & Handoff
- Finalize all docs (STATE, RELEASE, PLAYBOOK)
- Record any final ADRs in DECISIONS.md
- Update RISKS.md with any new findings
- Write final RELEASE.md notes for v1.0
