# Release Notes

## v1.0 — Initial Release

### Shipped
- Navigation blocking: NSFW subreddit redirect via DNR (Chrome) + webRequest (Firefox) + content script fallback
- Search filtering: removes NSFW communities, posts, users, and autocomplete suggestions via MutationObserver
- Shadow DOM handling for Reddit's search autocomplete component
- Whitelist management: add/remove subreddits, case-insensitive, persisted to storage.local
- Master toggle: enable/disable all blocking with immediate effect
- Icon state: colored when enabled, greyed out when disabled
- Popup UI: clean, minimal, dark mode support via prefers-color-scheme
- NSFW cache: 30-day TTL, in-memory Map, persisted to storage.local
- Fail-open policy: unknown subreddits are allowed through
- Cross-browser: single codebase for Chrome and Firefox (Manifest V3)
- Zero dependencies: pure vanilla JS/HTML/CSS, no build step

### Deferred
- old.reddit.com support
- Custom redirect target
- Sync across devices
- Import/export whitelist
- Statistics/counters
- Per-subreddit soft-block
- NSFW image/thumbnail blurring
- Automated tests/CI
- Extension store publishing
- Separate options page
- Scheduled cache refresh
