# Commands

## Loading the Extension

### Chrome
1. Open `chrome://extensions/`
2. Enable "Developer mode" (top right toggle)
3. Click "Load unpacked"
4. Select the project root directory (`NSFW-away/`)
5. Confirm the extension appears with no errors

### Firefox
1. Open `about:debugging#/runtime/this-firefox`
2. Click "Load Temporary Add-on..."
3. Select `manifest.json` from the project root
4. Confirm the extension appears with no errors

### Reloading After Changes
- **Chrome:** Click the reload icon on the extension card at `chrome://extensions/`
- **Firefox:** Click "Reload" on the extension card at `about:debugging`

---

## Quality Scripts

### Healthcheck
Verifies manifest validity, required files exist, and JSON is well-formed.
```bash
node scripts/healthcheck.js
```

### Smoke Test
Basic verification that the extension structure is correct and key message handlers are defined.
```bash
node scripts/smoke.js
```

### Acceptance Test
Runs automated checks against acceptance criteria (file-level checks only; browser-level tests are manual).
```bash
node scripts/acceptance.js
```

---

## Icon Generation
Generates all icon PNGs (16, 32, 48, 128px) in active and inactive variants.
```bash
node scripts/generate-icons.js
```

---

## Useful Browser Console Commands

### Check Extension Storage (from background console)
```js
const api = typeof browser !== 'undefined' ? browser : chrome;
api.storage.local.get(null).then(data => console.log(data));
```

### Clear Extension Storage
```js
api.storage.local.clear().then(() => console.log('Storage cleared'));
```

### Check if a Subreddit is Cached
```js
api.storage.local.get('nsfwCache').then(({nsfwCache}) => {
  const map = new Map(nsfwCache || []);
  console.log(map.get('subredditname'));
});
```
