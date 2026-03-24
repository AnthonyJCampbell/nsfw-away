# Acceptance Criteria

Checklist derived from the five core user journeys.

---

## Journey 1: Block Direct Navigation to NSFW Subreddit
- [ ] User navigates to `reddit.com/r/{nsfw-subreddit}`
- [ ] Extension detects the subreddit is NSFW (via cache or API)
- [ ] Navigation is blocked before page content renders (DNR/webRequest)
- [ ] User is redirected to a safe page
- [ ] Blocking works on Chrome
- [ ] Blocking works on Firefox
- [ ] Content script fallback catches any missed navigations

## Journey 2: Filter NSFW from Search Results
- [ ] User searches on `reddit.com/search`
- [ ] Content script scans search results for subreddit references
- [ ] NSFW subreddit results are hidden from the DOM
- [ ] SFW results remain fully visible and functional
- [ ] Dynamically loaded results (infinite scroll) are also filtered
- [ ] No visual jank or flickering during filtering

## Journey 3: Whitelist an NSFW Subreddit
- [ ] User opens the popup
- [ ] User adds a subreddit name to the whitelist
- [ ] Whitelist is persisted to `storage.local`
- [ ] Whitelisted subreddit is no longer blocked on navigation
- [ ] Whitelisted subreddit is no longer hidden in search results
- [ ] User can remove a subreddit from the whitelist
- [ ] Removal re-enables blocking for that subreddit

## Journey 4: Toggle Extension On/Off
- [ ] User opens the popup
- [ ] User toggles the extension OFF
- [ ] All blocking and filtering immediately stops
- [ ] Badge/icon updates to reflect disabled state
- [ ] User toggles the extension ON
- [ ] All blocking and filtering immediately resumes
- [ ] Badge/icon updates to reflect enabled state

## Journey 5: Graceful Degradation on API Failure
- [ ] Reddit API is unreachable (network error, rate limit, etc.)
- [ ] Extension does not block the subreddit (fail-open)
- [ ] Error is logged to console for debugging
- [ ] User's browsing experience is not disrupted
- [ ] Cached results are still used for previously looked-up subreddits
- [ ] Extension resumes normal API lookups when connectivity is restored
