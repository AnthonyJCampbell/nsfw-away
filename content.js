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
})();

// ============================================================
// PART 2: Search Filtering
// ============================================================

(function searchFiltering() {
  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSearchFiltering);
  } else {
    initSearchFiltering();
  }

  function initSearchFiltering() {
    // Only run on search pages
    if (!isSearchPage()) return;

    // Initial scan + observer
    startFiltering();

    // Re-check on URL changes (Reddit SPA navigation)
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

  let mainObserver = null;
  const observedShadowRoots = new WeakSet();

  function startFiltering() {
    // Run initial filter pass with polling fallback
    let pollCount = 0;
    const pollInterval = setInterval(() => {
      filterAllResults();
      pollCount++;
      if (pollCount >= 20) clearInterval(pollInterval);
    }, 500);

    // Set up MutationObserver on the main document
    if (mainObserver) mainObserver.disconnect();
    mainObserver = new MutationObserver(() => {
      filterAllResults();
    });
    mainObserver.observe(document.body || document.documentElement, {
      childList: true,
      subtree: true
    });

    // Initial filter
    filterAllResults();
  }

  function filterAllResults() {
    filterSearchResults();
    filterAutocomplete();
  }

  // --- Search results filtering ---

  function filterSearchResults() {
    const selectors = [
      '[data-testid="search-community"]',
      '[data-testid="search-post-unit"]',
      '[data-testid="search-author"]'
    ];

    for (const selector of selectors) {
      const elements = document.querySelectorAll(selector);
      for (const el of elements) {
        checkAndRemoveElement(el);
      }
    }
  }

  function checkAndRemoveElement(el) {
    if (isElementNSFW(el)) {
      const subreddit = extractSubredditFromElement(el);
      if (subreddit) {
        // Check whitelist via background
        api.runtime.sendMessage({ type: 'checkNSFW', subreddit }, (response) => {
          if (api.runtime.lastError) return;
          if (response && response.isNSFW) {
            removeResultElement(el);
          }
        });
      } else {
        // No subreddit extracted but element is marked NSFW — remove it
        // But first check if the background confirms (it checks enabled state)
        removeResultElement(el);
      }
    }
  }

  function isElementNSFW(el) {
    // Check for NSFW CSS class or icon
    if (el.querySelector('.text-category-nsfw') || el.querySelector('[icon-name="nsfw-fill"]')) {
      return true;
    }

    // Check tracking context on ancestor
    const tracker = el.closest('search-telemetry-tracker') || el;
    const ctx = tracker.getAttribute('data-faceplate-tracking-context');
    if (ctx) {
      try {
        const parsed = JSON.parse(ctx);
        if (parsed?.nsfw === true) return true;
        // Also check nested paths
        if (parsed?.post?.nsfw === true) return true;
        if (parsed?.subreddit?.nsfw === true) return true;
      } catch (e) {
        // ignore parse errors
      }
    }

    // Check self for tracking context
    const selfCtx = el.getAttribute('data-faceplate-tracking-context');
    if (selfCtx && selfCtx !== ctx) {
      try {
        const parsed = JSON.parse(selfCtx);
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
    // Try tracking context first
    const tracker = el.closest('search-telemetry-tracker') || el;
    const ctx = tracker.getAttribute('data-faceplate-tracking-context') ||
                el.getAttribute('data-faceplate-tracking-context');
    if (ctx) {
      try {
        const parsed = JSON.parse(ctx);
        const name = parsed?.subreddit?.name ||
                     parsed?.data?.subreddit?.name;
        if (name) return name.toLowerCase();
      } catch (e) {
        // ignore
      }
    }

    // Try to find subreddit link in element
    const link = el.querySelector('a[href*="/r/"]');
    if (link) {
      const match = link.getAttribute('href').match(/\/r\/([A-Za-z0-9_]+)/);
      if (match) return match[1].toLowerCase();
    }

    return null;
  }

  function removeResultElement(el) {
    // Find the wrapper (search-telemetry-tracker or the element itself)
    const wrapper = el.closest('search-telemetry-tracker') || el;

    // Remove following hr.list-divider-line sibling
    const next = wrapper.nextElementSibling;
    if (next && next.matches('hr.list-divider-line')) {
      next.remove();
    }

    wrapper.remove();
  }

  // --- Autocomplete / Shadow DOM filtering ---

  function filterAutocomplete() {
    // Look for reddit-search-large custom element
    const searchElements = document.querySelectorAll('reddit-search-large');
    for (const el of searchElements) {
      if (el.shadowRoot && !observedShadowRoots.has(el.shadowRoot)) {
        observedShadowRoots.add(el.shadowRoot);
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
    // Remove NSFW typeahead sections
    // Try multiple selectors for the NSFW section
    const nsfwSections = shadowRoot.querySelectorAll(
      'summary[aria-controls*="nsfw" i], #nsfw_typeahead_section, [id*="nsfw" i]'
    );

    for (const section of nsfwSections) {
      // Find the parent details/container and remove it
      const container = section.closest('details') || section.parentElement;
      if (container) {
        container.remove();
      } else {
        section.remove();
      }
    }
  }
})();
