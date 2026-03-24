# Testing Strategy

All tests are manual. Automated browser-level testing is deferred to a future release.

---

## Test Cases

### TC-1: Direct Navigation to NSFW Subreddit
**Steps:**
1. Ensure extension is enabled
2. Navigate to a known NSFW subreddit (e.g., `reddit.com/r/nsfw`)
**Expected:** Navigation is blocked; user is redirected to a safe page
**Pass criteria:** User never sees NSFW subreddit content

### TC-2: Direct Navigation to SFW Subreddit
**Steps:**
1. Ensure extension is enabled
2. Navigate to a known SFW subreddit (e.g., `reddit.com/r/pics`)
**Expected:** Page loads normally with no interference
**Pass criteria:** Subreddit content is fully visible and functional

### TC-3: NSFW Results Hidden in Search
**Steps:**
1. Ensure extension is enabled
2. Go to `reddit.com/search` and search a term that returns mixed SFW/NSFW results
**Expected:** NSFW subreddit results are hidden from the search results
**Pass criteria:** No NSFW subreddit cards/links visible in results

### TC-4: Whitelisted NSFW Subreddit Allowed
**Steps:**
1. Open popup, add a known NSFW subreddit to the whitelist
2. Navigate to that subreddit
**Expected:** Page loads normally (not blocked)
**Pass criteria:** Whitelisted subreddit is accessible

### TC-5: Toggle Off Disables All Blocking
**Steps:**
1. Open popup, toggle extension OFF
2. Navigate to a known NSFW subreddit
**Expected:** Page loads normally (blocking is disabled)
**Pass criteria:** NSFW content is accessible when extension is off

### TC-6: Toggle On Re-enables Blocking
**Steps:**
1. Open popup, toggle extension ON (after being off)
2. Navigate to a known NSFW subreddit
**Expected:** Navigation is blocked again
**Pass criteria:** Blocking resumes immediately

### TC-7: API Failure Fail-Open
**Steps:**
1. Disconnect from the internet (or block Reddit API requests)
2. Navigate to an NSFW subreddit not yet in cache
**Expected:** Page loads normally (fail-open behavior)
**Pass criteria:** User is not blocked from browsing when API is unavailable

### TC-8: Cache Persistence Across Restart
**Steps:**
1. Visit several subreddits to populate the cache
2. Restart the browser (or reload the extension)
3. Check extension storage for cached entries
**Expected:** Cache entries survive restart with correct TTL timestamps
**Pass criteria:** Previously cached subreddits are still in storage

---

## Test Environment

| Browser | Version | OS |
|---------|---------|-----|
| Chrome  | Latest stable | macOS / Windows |
| Firefox | Latest stable | macOS / Windows |

## Test Frequency
- Run TC-1 through TC-6 after every content script or background script change
- Run TC-7 when modifying API or cache logic
- Run TC-8 when modifying storage or cache persistence logic
