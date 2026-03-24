# Risks

## R1: Reddit DOM Changes Break Search Filtering Selectors

**Likelihood:** High (Reddit updates their UI frequently)
**Impact:** Medium (search filtering stops working; navigation blocking still works)

**Mitigation:**
- Use multiple selector strategies (class names, data attributes, structural selectors)
- Log warnings when selectors fail to match any elements
- Design content script to degrade gracefully — if selectors break, extension still blocks navigation
- Document known selectors in code comments for quick updates

---

## R2: Reddit API Rate Limiting or Blocking Extension User-Agent

**Likelihood:** Medium
**Impact:** Medium (new subreddit lookups fail; cached results still work)

**Mitigation:**
- Cache aggressively with 30-day TTL to minimize API calls
- Batch lookups where possible to reduce request count
- Implement exponential backoff on 429 responses
- Fail-open policy ensures browsing continues even if API is blocked
- Use a reasonable User-Agent string

---

## R3: Chrome MV3 Service Worker Lifecycle

**Likelihood:** High (service workers are terminated after ~30 seconds of inactivity)
**Impact:** Medium (in-memory cache lost; must re-hydrate from storage)

**Mitigation:**
- Persist all state to `storage.local`
- Re-hydrate in-memory Map from storage on every service worker activation
- Keep re-hydration fast (deserialize a single array)
- Do not rely on in-memory state surviving across idle periods

---

## R4: Firefox MV3 webRequest Compatibility

**Likelihood:** Low-Medium (Firefox MV3 support is evolving)
**Impact:** High (navigation blocking may not work on Firefox)

**Mitigation:**
- Content script fallback provides a second layer of blocking
- Monitor Firefox MV3 release notes for webRequest changes
- Test on Firefox Nightly for early warning
- Maintain the dual-blocking architecture (DNR + webRequest + fallback)

---

## R5: Shadow DOM Access Restrictions Changing

**Likelihood:** Low
**Impact:** Medium (cannot filter NSFW results inside Shadow DOM)

**Mitigation:**
- Check for both open and closed Shadow DOM
- Use `querySelectorAll` on shadow roots where accessible
- If Shadow DOM is inaccessible, fall back to parent-level hiding
- Monitor browser API changes for Shadow DOM access policies
