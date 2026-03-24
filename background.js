// NSFW-Away — Background Service Worker
// Handles NSFW detection, caching, navigation blocking, and message API.

const api = (typeof browser !== 'undefined' && browser.runtime) ? browser : chrome;

// --- Constants ---
const CACHE_TTL = 2592000000; // 30 days in ms
const REDIRECT_URL = 'https://www.reddit.com/';
const USER_AGENT = 'reddit-nsfw-blocker/1.0';
const SUBREDDIT_URL_RE = /\/r\/([A-Za-z0-9_]+)/;

// --- In-memory state ---
let enabled = true;
let whitelist = [];
let nsfwCache = new Map(); // subreddit (lowercase) -> { isNSFW: boolean, timestamp: number }

// --- Storage helpers ---

async function loadState() {
  try {
    const data = await api.storage.local.get(['enabled', 'whitelist', 'nsfwCache']);
    if (typeof data.enabled === 'boolean') {
      enabled = data.enabled;
    } else if (typeof data.enabled === 'string') {
      enabled = JSON.parse(data.enabled);
    }
    if (data.whitelist) {
      whitelist = typeof data.whitelist === 'string' ? JSON.parse(data.whitelist) : data.whitelist;
    }
    if (data.nsfwCache) {
      const entries = typeof data.nsfwCache === 'string' ? JSON.parse(data.nsfwCache) : data.nsfwCache;
      const now = Date.now();
      nsfwCache = new Map();
      for (const [name, entry] of entries) {
        if (now - entry.timestamp < CACHE_TTL) {
          nsfwCache.set(name.toLowerCase(), entry);
        }
      }
    }
  } catch (e) {
    console.error('NSFW-Away: Failed to load state', e);
  }
}

async function saveCache() {
  try {
    const entries = Array.from(nsfwCache.entries());
    await api.storage.local.set({ nsfwCache: JSON.stringify(entries) });
  } catch (e) {
    console.error('NSFW-Away: Failed to save cache', e);
  }
}

function isWhitelisted(subreddit) {
  return whitelist.includes(subreddit.toLowerCase());
}

// --- Reddit API ---

async function checkSubredditNSFW(subreddit) {
  const sub = subreddit.toLowerCase();

  // Check cache first
  const cached = nsfwCache.get(sub);
  if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
    return cached.isNSFW;
  }

  // Fetch from Reddit API (fail-open)
  try {
    const resp = await fetch(`https://www.reddit.com/r/${encodeURIComponent(sub)}/about.json`, {
      headers: { 'User-Agent': USER_AGENT }
    });
    if (!resp.ok) {
      return false; // fail-open
    }
    const json = await resp.json();
    const isNSFW = json?.data?.over18 === true;

    // Update cache
    nsfwCache.set(sub, { isNSFW, timestamp: Date.now() });
    await saveCache();

    // If NSFW and on Chrome, add DNR rule
    if (isNSFW && !isWhitelisted(sub)) {
      await syncDNRRules();
    }

    return isNSFW;
  } catch (e) {
    console.warn('NSFW-Away: API fetch failed, fail-open for', sub, e);
    return false; // fail-open
  }
}

// --- Chrome DeclarativeNetRequest ---

const isChromium = typeof browser === 'undefined' || !browser.runtime;

async function syncDNRRules() {
  if (!isChromium) return; // Firefox uses webRequest instead
  if (!api.declarativeNetRequest) return;

  try {
    // Get existing rules to remove them
    const existingRules = await api.declarativeNetRequest.getDynamicRules();
    const removeIds = existingRules.map(r => r.id);

    const addRules = [];

    if (enabled) {
      let ruleId = 1;
      for (const [sub, entry] of nsfwCache) {
        if (entry.isNSFW && !isWhitelisted(sub)) {
          addRules.push({
            id: ruleId++,
            priority: 1,
            action: {
              type: 'redirect',
              redirect: { url: REDIRECT_URL }
            },
            condition: {
              urlFilter: `||reddit.com/r/${sub}`,
              resourceTypes: ['main_frame']
            }
          });
        }
      }
    }

    await api.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: removeIds,
      addRules: addRules
    });
  } catch (e) {
    console.error('NSFW-Away: Failed to sync DNR rules', e);
  }
}

// --- Firefox webRequest blocking ---

function setupFirefoxWebRequest() {
  if (isChromium) return;
  if (!api.webRequest || !api.webRequest.onBeforeRequest) return;

  api.webRequest.onBeforeRequest.addListener(
    (details) => {
      if (!enabled) return {};

      const match = details.url.match(SUBREDDIT_URL_RE);
      if (!match) return {};

      const sub = match[1].toLowerCase();
      if (isWhitelisted(sub)) return {};

      const cached = nsfwCache.get(sub);
      if (cached && cached.isNSFW) {
        return { redirectUrl: REDIRECT_URL };
      }

      // If not cached, allow through (fail-open) and check async for next time
      if (!cached) {
        checkSubredditNSFW(sub);
      }

      return {};
    },
    { urls: ['*://*.reddit.com/r/*'], types: ['main_frame'] },
    ['blocking']
  );
}

// --- Icon management ---

async function updateIcon() {
  try {
    const path = enabled
      ? {
          16: 'icons/icon-16.png',
          32: 'icons/icon-32.png',
          48: 'icons/icon-48.png',
          128: 'icons/icon-128.png'
        }
      : {
          16: 'icons/icon-disabled-16.png',
          32: 'icons/icon-disabled-32.png',
          48: 'icons/icon-disabled-48.png',
          128: 'icons/icon-disabled-128.png'
        };
    await api.action.setIcon({ path });
  } catch (e) {
    console.warn('NSFW-Away: Failed to update icon', e);
  }
}

// --- Message handling ---

api.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || !message.type) return false;

  if (message.type === 'checkNSFW') {
    if (!enabled) {
      sendResponse({ isNSFW: false });
      return false;
    }
    const sub = (message.subreddit || '').toLowerCase();
    if (isWhitelisted(sub)) {
      sendResponse({ isNSFW: false });
      return false;
    }
    checkSubredditNSFW(sub).then(isNSFW => {
      sendResponse({ isNSFW });
    }).catch(() => {
      sendResponse({ isNSFW: false });
    });
    return true; // async response
  }

  if (message.type === 'checkNSFWBatch') {
    if (!enabled) {
      const results = (message.subreddits || []).map(s => ({ subreddit: s, isNSFW: false }));
      sendResponse({ results });
      return false;
    }
    const subs = message.subreddits || [];
    Promise.all(subs.map(async (s) => {
      const sub = s.toLowerCase();
      if (isWhitelisted(sub)) return { subreddit: s, isNSFW: false };
      const isNSFW = await checkSubredditNSFW(sub);
      return { subreddit: s, isNSFW };
    })).then(results => {
      sendResponse({ results });
    }).catch(() => {
      const results = subs.map(s => ({ subreddit: s, isNSFW: false }));
      sendResponse({ results });
    });
    return true; // async response
  }

  if (message.type === 'getState') {
    sendResponse({ enabled, whitelist });
    return false;
  }

  if (message.type === 'checkNavigation') {
    if (!enabled) {
      sendResponse({ isNSFW: false });
      return false;
    }
    const sub = (message.subreddit || '').toLowerCase();
    if (isWhitelisted(sub)) {
      sendResponse({ isNSFW: false });
      return false;
    }
    checkSubredditNSFW(sub).then(isNSFW => {
      sendResponse({ isNSFW });
    }).catch(() => {
      sendResponse({ isNSFW: false });
    });
    return true; // async response
  }

  return false;
});

// --- Storage change listener (sync in-memory state when popup changes settings) ---

api.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;

  if (changes.enabled) {
    const newVal = changes.enabled.newValue;
    enabled = typeof newVal === 'string' ? JSON.parse(newVal) : newVal;
    updateIcon();
    syncDNRRules();
  }

  if (changes.whitelist) {
    const newVal = changes.whitelist.newValue;
    whitelist = typeof newVal === 'string' ? JSON.parse(newVal) : newVal;
    syncDNRRules();
  }

  if (changes.nsfwCache) {
    const newVal = changes.nsfwCache.newValue;
    try {
      const entries = typeof newVal === 'string' ? JSON.parse(newVal) : newVal;
      const now = Date.now();
      nsfwCache = new Map();
      for (const [name, entry] of entries) {
        if (now - entry.timestamp < CACHE_TTL) {
          nsfwCache.set(name.toLowerCase(), entry);
        }
      }
    } catch (e) {
      // ignore parse errors
    }
  }
});

// --- Initialization ---

async function init() {
  await loadState();
  await updateIcon();
  await syncDNRRules();
  setupFirefoxWebRequest();
}

init();
