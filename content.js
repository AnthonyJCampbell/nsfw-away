// NSFW-Away — Content Script
// Runs at document_start on all reddit.com pages.
// 1. Navigation fallback: checks current URL and redirects if NSFW.
// 2. Search filtering: removes NSFW results from search pages.

const api = (typeof browser !== 'undefined' && browser.runtime) ? browser : chrome;

const REDIRECT_URL = 'https://www.reddit.com/';
const SUBREDDIT_URL_RE = /^\/r\/([A-Za-z0-9_]+)/;

// ============================================================
// PART 1: Navigation Fallback
// ============================================================

(function navigationFallback() {
  function checkCurrentUrl() {
    const path = window.location.pathname;
    const match = path.match(SUBREDDIT_URL_RE);
    if (!match) return;

    const subreddit = match[1];

    api.runtime.sendMessage({ type: 'checkNavigation', subreddit }, (response) => {
      if (api.runtime.lastError) return; // extension context invalidated
      if (response && response.isNSFW) {
        window.stop();
        window.location.replace(REDIRECT_URL);
      }
    });
  }

  // Run on initial page load
  checkCurrentUrl();

  // Also monitor for SPA navigation (Reddit uses history.pushState)
  let lastNavUrl = location.href;
  const navObserver = new MutationObserver(() => {
    if (location.href !== lastNavUrl) {
      lastNavUrl = location.href;
      checkCurrentUrl();
    }
  });

  const startNavObserver = () => {
    const target = document.body || document.documentElement;
    if (target) {
      navObserver.observe(target, { childList: true, subtree: true });
    } else {
      document.addEventListener('DOMContentLoaded', () => {
        navObserver.observe(document.body || document.documentElement, { childList: true, subtree: true });
      });
    }
  };
  startNavObserver();
})();

// ============================================================
// PART 2: Search Filtering
// ============================================================

(function searchFiltering() {
  // --- Local state cache ---
  // We trust Reddit's own DOM NSFW markers and avoid hitting the Reddit API
  // entirely for search filtering (which caused 429 rate-limit errors).
  let localEnabled = true;
  let localWhitelist = [];
  let mainObserver = null;

  api.runtime.sendMessage({ type: 'getState' }, (response) => {
    if (api.runtime.lastError) return;
    if (response) {
      localEnabled = response.enabled;
      localWhitelist = (response.whitelist || []).map(s => s.toLowerCase());
    }
  });

  api.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes.enabled) {
      const v = changes.enabled.newValue;
      localEnabled = typeof v === 'string' ? JSON.parse(v) : v;
    }
    if (changes.whitelist) {
      const v = changes.whitelist.newValue;
      const arr = typeof v === 'string' ? JSON.parse(v) : v;
      localWhitelist = (arr || []).map(s => s.toLowerCase());
    }
  });

  // --- Init ---

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSearchFiltering);
  } else {
    initSearchFiltering();
  }

  function initSearchFiltering() {
    if (!isSearchPage()) return;

    startFiltering();

    let lastUrl = location.href;
    const urlObserver = new MutationObserver(() => {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        if (isSearchPage()) {
          startFiltering();
        }
      }
    });
    urlObserver.observe(document.body || document.documentElement, {
      childList: true,
      subtree: true
    });
  }

  function isSearchPage() {
    return location.pathname.startsWith('/search');
  }

  // --- Main filtering logic ---

  function startFiltering() {
    if (mainObserver) mainObserver.disconnect();
    mainObserver = new MutationObserver(() => {
      filterAllResults();
    });
    mainObserver.observe(document.body || document.documentElement, {
      childList: true,
      subtree: true
    });

    filterAllResults();
  }

  function filterAllResults() {
    filterSearchResults();
    filterAutocomplete();
  }

  // --- Search results filtering ---

  function filterSearchResults() {
    if (!localEnabled) return;

    // Named result cards
    const cardSelectors = [
      '[data-testid="search-community"]',
      '[data-testid="search-post-unit"]',
      '[data-testid="search-author"]'
    ];
    for (const selector of cardSelectors) {
      for (const el of document.querySelectorAll(selector)) {
        maybeRemove(el);
      }
    }

    // Catch any remaining elements Reddit tagged as NSFW that aren't
    // covered by the card selectors above (e.g. sidebar community cards)
    for (const el of document.querySelectorAll('.text-category-nsfw, [icon-name="nsfw-fill"]')) {
      const card = el.closest('search-telemetry-tracker, [data-testid], li, article') || el.parentElement;
      if (card) maybeRemove(card);
    }
  }

  function maybeRemove(el) {
    if (el.dataset.nsfwChecked) return; // already processed
    el.dataset.nsfwChecked = '1';

    if (!isElementNSFW(el)) return;

    const subreddit = extractSubredditFromElement(el);
    if (subreddit && localWhitelist.includes(subreddit)) return;

    removeResultElement(el);
  }

  function isElementNSFW(el) {
    if (el.querySelector('.text-category-nsfw') || el.querySelector('[icon-name="nsfw-fill"]')) {
      return true;
    }

    // Check faceplate tracking context on element or nearest tracker ancestor
    const candidates = [el, el.closest('search-telemetry-tracker')].filter(Boolean);
    for (const node of candidates) {
      const ctx = node.getAttribute('data-faceplate-tracking-context');
      if (!ctx) continue;
      try {
        const parsed = JSON.parse(ctx);
        if (parsed?.nsfw === true) return true;
        if (parsed?.post?.nsfw === true) return true;
        if (parsed?.subreddit?.nsfw === true) return true;
      } catch (e) {
        // ignore
      }
    }

    return false;
  }

  function extractSubredditFromElement(el) {
    const candidates = [el, el.closest('search-telemetry-tracker')].filter(Boolean);
    for (const node of candidates) {
      const ctx = node.getAttribute('data-faceplate-tracking-context');
      if (!ctx) continue;
      try {
        const parsed = JSON.parse(ctx);
        const name = parsed?.subreddit?.name || parsed?.data?.subreddit?.name;
        if (name) return name.toLowerCase();
      } catch (e) {
        // ignore
      }
    }

    const link = el.querySelector('a[href*="/r/"]');
    if (link) {
      const match = link.getAttribute('href').match(/\/r\/([A-Za-z0-9_]+)/);
      if (match) return match[1].toLowerCase();
    }

    return null;
  }

  function removeResultElement(el) {
    const wrapper = el.closest('search-telemetry-tracker') || el;
    const next = wrapper.nextElementSibling;
    if (next && next.matches('hr.list-divider-line')) {
      next.remove();
    }
    wrapper.remove();
  }

  // --- Autocomplete / Shadow DOM filtering ---

  const observedShadowRootsSet = new WeakSet();

  function filterAutocomplete() {
    const searchElements = document.querySelectorAll('reddit-search-large');
    for (const el of searchElements) {
      if (el.shadowRoot && !observedShadowRootsSet.has(el.shadowRoot)) {
        observedShadowRootsSet.add(el.shadowRoot);
        observeShadowRoot(el.shadowRoot);
      }
      if (el.shadowRoot) {
        filterShadowRoot(el.shadowRoot);
      }
    }
  }

  function observeShadowRoot(shadowRoot) {
    const observer = new MutationObserver(() => {
      filterShadowRoot(shadowRoot);
    });
    observer.observe(shadowRoot, { childList: true, subtree: true });
  }

  function filterShadowRoot(shadowRoot) {
    const nsfwSections = shadowRoot.querySelectorAll(
      'summary[aria-controls*="nsfw" i], #nsfw_typeahead_section, [id*="nsfw" i]'
    );
    for (const section of nsfwSections) {
      const container = section.closest('details') || section.parentElement;
      if (container) {
        container.remove();
      } else {
        section.remove();
      }
    }
  }
})();

// ============================================================
// PART 3: Redgifs Embed Blocking
// ============================================================

(function redgifsBlocking() {
  let enabled = true;

  api.runtime.sendMessage({ type: 'getState' }, (response) => {
    if (api.runtime.lastError) return;
    if (response) enabled = response.enabled;
  });

  api.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes.enabled) return;
    const v = changes.enabled.newValue;
    enabled = typeof v === 'string' ? JSON.parse(v) : v;
  });

  function removeWithSibling(el) {
    const next = el.nextElementSibling;
    if (next && next.tagName === 'HR') next.remove();
    el.remove();
  }

  function removeRedgifsElements() {
    if (!enabled) return;

    // Remove entire post cards where the content is from redgifs.com
    // (domain attr is server-rendered, available before custom element init)
    for (const el of document.querySelectorAll(
      'shreddit-post[domain="redgifs.com"], shreddit-post[content-href*="redgifs.com"]'
    )) {
      const article = el.closest('article') || el;
      removeWithSibling(article);
    }

    // Remove redgifs embeds before the iframe is rendered by the custom element
    for (const el of document.querySelectorAll(
      'shreddit-embed[providername="RedGIFs"], shreddit-embed[html*="redgifs.com"]'
    )) {
      (el.closest('shreddit-aspect-ratio, shreddit-async-loader') || el).remove();
    }

    // Catch any already-rendered iframes
    for (const el of document.querySelectorAll('iframe[src*="redgifs.com"]')) {
      el.remove();
    }
  }

  const observedRoots = new WeakSet();

  function observeRoot(root) {
    if (observedRoots.has(root)) return;
    observedRoots.add(root);
    new MutationObserver(() => {
      removeRedgifsElements();
      attachShadowObservers();
    }).observe(root, { childList: true, subtree: true });
  }

  // Reddit uses shadow DOMs inside custom elements for feed containers.
  // Walk all open shadow roots and observe them too.
  function attachShadowObservers() {
    const candidates = document.querySelectorAll('shreddit-feed, faceplate-batch, shreddit-profile-feed');
    for (const el of candidates) {
      if (el.shadowRoot) observeRoot(el.shadowRoot);
    }
  }

  const start = () => {
    removeRedgifsElements();
    observeRoot(document.body || document.documentElement);
    attachShadowObservers();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
