# Architecture

## Module Responsibilities

### background.js (Service Worker)
- Owns all Reddit API communication
- Maintains in-memory NSFW cache (`Map`)
- Persists cache to `storage.local`
- Handles message passing from content scripts and popup
- Manages Chrome DNR rules for navigation blocking
- Manages Firefox webRequest listeners for navigation blocking
- Prunes expired cache entries on startup

### content.js (Content Script)
- Runs on all `reddit.com` pages
- Scans DOM for subreddit references (search results, feeds, sidebars)
- Uses `MutationObserver` to handle dynamically loaded content
- Sends `checkNSFW` / `checkNSFWBatch` messages to background
- Hides/removes NSFW elements from the DOM
- Provides fallback navigation blocking (redirect if on NSFW page)

### popup/ (Extension Popup)
- `popup.html` — UI structure
- `popup.css` — Styling, dark mode support
- `popup.js` — Toggle enable/disable, manage whitelist, read/write settings

---

## Data Flow

```
storage.local
    |
    | read/write
    v
background.js (service worker)
    |
    | message passing (chrome.runtime.sendMessage / onMessage)
    |
    +---> content.js (content script on reddit.com)
    |         |
    |         | DOM manipulation (hide NSFW elements)
    |         v
    |       Reddit page DOM
    |
    +---> popup.js (extension popup)
              |
              | read/write settings
              v
            storage.local
```

### Startup Flow
1. Service worker activates
2. Load `nsfwCache` from `storage.local`
3. Deserialize into in-memory `Map`
4. Prune entries older than 30 days
5. Persist pruned cache back to storage
6. Register DNR rules (Chrome) or webRequest listeners (Firefox)

### Content Script Flow
1. Content script injects on reddit.com pages
2. Extract subreddit names from visible DOM elements
3. Send `checkNSFWBatch` to background
4. Receive results, hide NSFW elements
5. Set up `MutationObserver` for new content
6. On mutation, repeat steps 2-4 for new elements

---

## Message API Contracts

### checkNSFW
**Direction:** content.js / popup.js -> background.js
```js
// Request
{ action: "checkNSFW", subreddit: "subredditname" }

// Response
{ nsfw: true | false }
```

### checkNSFWBatch
**Direction:** content.js -> background.js
```js
// Request
{ action: "checkNSFWBatch", subreddits: ["sub1", "sub2", "sub3"] }

// Response
{ results: { "sub1": true, "sub2": false, "sub3": true } }
```

### checkNavigation
**Direction:** content.js -> background.js
```js
// Request
{ action: "checkNavigation", subreddit: "subredditname" }

// Response
{ blocked: true | false, whitelisted: false | true }
```

### getSettings
**Direction:** popup.js -> background.js
```js
// Request
{ action: "getSettings" }

// Response
{ enabled: true, whitelist: ["sub1", "sub2"], darkMode: false }
```

### updateSettings
**Direction:** popup.js -> background.js
```js
// Request
{ action: "updateSettings", settings: { enabled: true, whitelist: [...] } }

// Response
{ success: true }
```

---

## Storage Schema

All data stored in `storage.local`:

```js
{
  // Global enable/disable toggle
  "enabled": true,                    // boolean, default: true

  // Whitelisted subreddits (NSFW subs the user explicitly allows)
  "whitelist": ["sub1", "sub2"],      // string[], default: []

  // NSFW lookup cache — serialized Map entries
  // Each entry: [subreddit, { nsfw: boolean, timestamp: number }]
  "nsfwCache": [
    ["subreddit1", { "nsfw": true,  "timestamp": 1709136000000 }],
    ["subreddit2", { "nsfw": false, "timestamp": 1709136000000 }]
  ],

  // Dark mode preference
  "darkMode": false                   // boolean, default: false
}
```

### Cache Entry Structure
| Field | Type | Description |
|-------|------|-------------|
| `nsfw` | boolean | Whether the subreddit is marked NSFW |
| `timestamp` | number | Unix epoch ms when the entry was cached |

### TTL Policy
- Entries older than 30 days are pruned on startup
- TTL = 2,592,000,000 ms (30 * 24 * 60 * 60 * 1000)
