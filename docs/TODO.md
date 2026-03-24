# TODO — Ranked Task List

## Phase 0: Scaffold & Docs
- [x] Create directory structure
- [x] Write documentation files
- [ ] Review and finalize SPEC.md

## Phase 1: Core Extension Skeleton
- [ ] Create `manifest.json` (permissions, content scripts, background service worker)
- [ ] Create `background.js` with API namespace shim
- [ ] Create `content.js` with namespace shim
- [ ] Create `popup/popup.html` stub
- [ ] Create `popup/popup.css` stub
- [ ] Create `popup/popup.js` stub
- [ ] Load extension in Chrome — confirm no errors
- [ ] Load extension in Firefox — confirm no errors

## Phase 2: NSFW Detection & Caching
- [ ] Implement `fetchSubredditInfo(subreddit)` — call Reddit API
- [ ] Parse `over18` from API response
- [ ] Implement fail-open: API error = treat as SFW
- [ ] Create in-memory `Map` for NSFW cache
- [ ] Implement `storage.local` persistence (serialized array)
- [ ] Implement 30-day TTL per entry
- [ ] Prune expired entries on startup
- [ ] Implement `checkNSFW` message handler
- [ ] Implement `checkNSFWBatch` message handler

## Phase 3: Navigation Blocking
- [ ] Implement Chrome DNR rule creation for known NSFW subreddits
- [ ] Implement Firefox `webRequest.onBeforeRequest` blocking
- [ ] Implement content script fallback redirect
- [ ] Respect whitelist in all blocking paths
- [ ] Respect enabled/disabled state
- [ ] Choose and implement redirect target

## Phase 4: Search Filtering
- [ ] Identify Reddit search result DOM selectors
- [ ] Identify Reddit feed/sidebar DOM selectors
- [ ] Implement `MutationObserver` for dynamic content
- [ ] Extract subreddit names from DOM elements
- [ ] Batch-check via `checkNSFWBatch` message
- [ ] Hide/remove NSFW elements from DOM
- [ ] Handle Shadow DOM if present

## Phase 5: Popup UI
- [ ] Build toggle switch (enable/disable)
- [ ] Build whitelist management UI (add/remove)
- [ ] Implement dark mode (toggle or system auto-detect)
- [ ] Show current subreddit context
- [ ] Wire up `storage.local` read/write

## Phase 6: Icons & Badge
- [ ] Write `scripts/generate-icons.js`
- [ ] Generate 16/32/48/128px active icons
- [ ] Generate 16/32/48/128px inactive (greyed) icons
- [ ] Set badge text on state change
- [ ] Swap icon on toggle

## Phase 7: Quality Rails
- [ ] Write `scripts/healthcheck.js`
- [ ] Write `scripts/smoke.js`
- [ ] Write `scripts/acceptance.js`
- [ ] Run all scripts and fix issues

## Phase 8: Hardening
- [ ] Wrap all storage ops in try/catch
- [ ] Handle service worker restart (re-hydrate cache)
- [ ] Handle edge cases (deleted/private/quarantined subs)
- [ ] Add Reddit API rate-limit handling
- [ ] Stress-test with large cache and whitelist

## Phase 9: Documentation & Handoff
- [ ] Update STATE.md to reflect completion
- [ ] Finalize RELEASE.md
- [ ] Update PLAYBOOK.md with lessons learned
- [ ] Final review of all docs
